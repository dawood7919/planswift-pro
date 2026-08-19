package com.takeoff.nativeapp

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

data class NativeCloudProject(
    val id: String,
    val name: String,
    val clientName: String?,
    val location: String?,
    val currency: String,
    val lengthUnit: String,
    val updatedAt: String
)

data class NativeCloudDocument(
    val id: String,
    val originalName: String,
    val byteSize: Long,
    val pageCount: Int
)

data class NativeDeviceConnection(
    val endpoint: String,
    val token: String,
    val expiresAtEpochMillis: Long,
    val cachedProjects: List<NativeCloudProject> = emptyList()
) {
    fun isExpired(now: Long = System.currentTimeMillis()): Boolean = now >= expiresAtEpochMillis
}

class NativeConnectionStore(context: Context) {
    private val preferences = EncryptedSharedPreferences.create(
        context,
        "takeoff-native-device-session",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun load(): NativeDeviceConnection? = runCatching {
        val endpoint = preferences.getString("endpoint", null) ?: return null
        val token = preferences.getString("token", null) ?: return null
        val expiresAt = preferences.getLong("expiresAt", 0L)
        if (expiresAt <= 0L) return null
        val projects = preferences.getString("cachedProjects", "[]")?.let(::projectsFromJson).orEmpty()
        NativeDeviceConnection(endpoint, token, expiresAt, projects)
    }.getOrNull()

    fun save(connection: NativeDeviceConnection) {
        preferences.edit()
            .putString("endpoint", connection.endpoint)
            .putString("token", connection.token)
            .putLong("expiresAt", connection.expiresAtEpochMillis)
            .putString("cachedProjects", projectsToJson(connection.cachedProjects))
            .apply()
    }

    fun clear() {
        preferences.edit().clear().apply()
    }

    fun normalizeEndpoint(value: String): String? = runCatching {
        val normalized = value.trim().removeSuffix("/")
        val url = URL(normalized)
        if (url.protocol != "https" || url.host.isNullOrBlank() || url.query != null || url.ref != null) null else normalized
    }.getOrNull()

    private fun projectsToJson(projects: List<NativeCloudProject>) = JSONArray().apply {
        projects.forEach { project ->
            put(JSONObject()
                .put("id", project.id)
                .put("name", project.name)
                .put("clientName", project.clientName ?: "")
                .put("location", project.location ?: "")
                .put("currency", project.currency)
                .put("lengthUnit", project.lengthUnit)
                .put("updatedAt", project.updatedAt)
            )
        }
    }.toString()

    private fun projectsFromJson(raw: String): List<NativeCloudProject> = buildList {
        val array = JSONArray(raw)
        for (index in 0 until array.length()) {
            val project = array.getJSONObject(index)
            add(NativeCloudProject(
                id = project.getString("id"),
                name = project.getString("name"),
                clientName = project.optString("clientName").ifBlank { null },
                location = project.optString("location").ifBlank { null },
                currency = project.getString("currency"),
                lengthUnit = project.getString("lengthUnit"),
                updatedAt = project.getString("updatedAt")
            ))
        }
    }

    companion object {
        const val DEFAULT_ENDPOINT = "https://takeoffweb-mxdy4ywn.manus.space"
    }
}

class NativeCloudApi {
    fun listProjects(connection: NativeDeviceConnection): List<NativeCloudProject> {
        val root = request(connection, "/api/native/v1/projects")
        val projects = root.getJSONArray("projects")
        return buildList {
            for (index in 0 until projects.length()) {
                val project = projects.getJSONObject(index)
                add(NativeCloudProject(
                    id = project.getString("id"),
                    name = project.getString("name"),
                    clientName = project.optString("clientName").ifBlank { null },
                    location = project.optString("location").ifBlank { null },
                    currency = project.getString("currency"),
                    lengthUnit = project.getString("lengthUnit"),
                    updatedAt = project.getString("updatedAt")
                ))
            }
        }
    }

    fun downloadProjectFile(connection: NativeDeviceConnection, projectId: String): String = requestText(connection, "/api/native/v1/projects/$projectId/project-file")

    fun listDocuments(connection: NativeDeviceConnection, projectId: String): List<NativeCloudDocument> {
        val documents = request(connection, "/api/native/v1/projects/$projectId/documents").getJSONArray("documents")
        return buildList {
            for (index in 0 until documents.length()) {
                val document = documents.getJSONObject(index)
                add(NativeCloudDocument(document.getString("id"), document.getString("originalName"), document.getLong("byteSize"), document.getInt("pageCount")))
            }
        }
    }

    fun downloadPdf(connection: NativeDeviceConnection, projectId: String, documentId: String, destination: File): File {
        if (connection.isExpired()) throw NativeCloudException("انتهت جلسة الجهاز. أنشئ رمز ربط جديداً من المنصة.")
        destination.parentFile?.mkdirs()
        val temporary = File(destination.parentFile, "${destination.name}.part")
        val http = (URL("${connection.endpoint}/api/native/v1/projects/$projectId/documents/$documentId/download").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            instanceFollowRedirects = true
            connectTimeout = 12_000
            readTimeout = 30_000
            setRequestProperty("Authorization", "Bearer ${connection.token}")
            setRequestProperty("Accept", "application/pdf")
            setRequestProperty("Cache-Control", "no-store")
        }
        return try {
            val responseCode = http.responseCode
            if (responseCode == 401) throw NativeCloudException("رمز ربط Android غير صالح أو انتهت صلاحيته.")
            if (responseCode == 404) throw NativeCloudException("وثيقة PDF غير متاحة لهذا الحساب.")
            if (responseCode !in 200..299) throw NativeCloudException("تعذر تنزيل PDF من المنصة (${responseCode}).")
            val advertisedSize = http.contentLengthLong
            if (advertisedSize > MAX_PDF_BYTES) throw NativeCloudException("حجم PDF يتجاوز الحد الآمن للتنزيل.")
            http.inputStream.use { input ->
                FileOutputStream(temporary).use { output ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    var total = 0L
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        total += read
                        if (total > MAX_PDF_BYTES) throw NativeCloudException("حجم PDF يتجاوز الحد الآمن للتنزيل.")
                        output.write(buffer, 0, read)
                    }
                }
            }
            if (!hasPdfSignature(temporary)) throw NativeCloudException("الملف المستلم ليس PDF صالحاً.")
            if (destination.exists()) destination.delete()
            if (!temporary.renameTo(destination)) throw NativeCloudException("تعذر حفظ PDF محلياً بصورة آمنة.")
            destination
        } catch (error: NativeCloudException) {
            temporary.delete()
            throw error
        } catch (error: Exception) {
            temporary.delete()
            throw NativeCloudException("تعذر تنزيل PDF. احتُفظت النسخة المحلية ويمكن إعادة المحاولة لاحقاً.", error)
        } finally {
            http.disconnect()
        }
    }

    private fun request(connection: NativeDeviceConnection, path: String): JSONObject = JSONObject(requestText(connection, path))

    private fun requestText(connection: NativeDeviceConnection, path: String): String {
        if (connection.isExpired()) throw NativeCloudException("انتهت جلسة الجهاز. أنشئ رمز ربط جديداً من المنصة.")
        val connectionUrl = URL("${connection.endpoint}$path")
        val http = (connectionUrl.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 12_000
            readTimeout = 12_000
            setRequestProperty("Authorization", "Bearer ${connection.token}")
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Cache-Control", "no-store")
        }
        return try {
            val responseCode = http.responseCode
            val body = (if (responseCode in 200..299) http.inputStream else http.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            when {
                responseCode in 200..299 -> body
                responseCode == 401 -> throw NativeCloudException("رمز ربط Android غير صالح أو انتهت صلاحيته.")
                responseCode == 404 -> throw NativeCloudException("المشروع غير متاح لهذا الحساب.")
                else -> throw NativeCloudException("تعذر الاتصال بالمنصة (${responseCode}). ${body.take(120)}")
            }
        } catch (error: NativeCloudException) {
            throw error
        } catch (error: Exception) {
            throw NativeCloudException("تعذر الاتصال بالمنصة. احتُفظ بالنسخة المحلية ويمكن إعادة المحاولة لاحقاً.", error)
        } finally {
            http.disconnect()
        }
    }

    companion object {
        const val MAX_PDF_BYTES = 25L * 1024L * 1024L

        fun hasPdfSignature(file: File): Boolean = runCatching {
            file.inputStream().use { input ->
                val header = ByteArray(5)
                input.read(header) == header.size && header.decodeToString() == "%PDF-"
            }
        }.getOrDefault(false)
    }
}

class NativeCloudException(message: String, cause: Throwable? = null) : Exception(message, cause)
