package com.takeoff.nativeapp

import android.content.Context
import com.takeoff.nativeapp.measurement.PlanPoint
import org.json.JSONArray
import org.json.JSONObject

data class StoredWorkspace(
    val project: NativeProject,
    val measurements: List<NativeMeasurement>,
    val calibration: NativeCalibration?,
    val layers: List<NativeLayer>,
    val selectedLayerId: Long
)

class NativeProjectStore(context: Context) {
    private val preferences = context.getSharedPreferences("takeoff-native-workspace", Context.MODE_PRIVATE)

    fun load(): StoredWorkspace? = runCatching {
        val raw = preferences.getString("workspace", null) ?: return null
        val root = JSONObject(raw)
        val pages = root.getJSONArray("pages").toList { page ->
            NativeProjectPage(
                id = page.getLong("id"),
                name = page.getString("name"),
                sourceUri = page.optString("sourceUri").ifBlank { null }
            )
        }
        val project = NativeProject(root.getLong("projectId"), root.getString("projectName"), pages)
        val layers = root.optJSONArray("layers")?.toList { layer ->
            NativeLayer(layer.getLong("id"), layer.getString("name"), layer.getLong("color"), layer.optBoolean("visible", true))
        } ?: listOf(NativeLayer(1L, "قياسات عامة", 0xFF59C3F5))
        val selectedLayerId = root.optLong("selectedLayerId", layers.first().id)
        val measurements = root.getJSONArray("measurements").toList { measurement ->
            NativeMeasurement(
                id = measurement.getLong("id"),
                kind = MeasurementKind.valueOf(measurement.getString("kind")),
                points = measurement.getJSONArray("points").toList { point -> PlanPoint(point.getDouble("x").toFloat(), point.getDouble("y").toFloat()) },
                value = measurement.getDouble("value"),
                layerId = measurement.optLong("layerId", selectedLayerId)
            )
        }
        val calibration = root.optJSONObject("calibration")?.let { NativeCalibration(it.getDouble("factor"), it.getString("unit")) }
        StoredWorkspace(project, measurements, calibration, layers, selectedLayerId)
    }.getOrNull()

    fun save(workspace: StoredWorkspace) {
        val root = JSONObject()
            .put("projectId", workspace.project.id)
            .put("projectName", workspace.project.name)
            .put("selectedLayerId", workspace.selectedLayerId)
            .put("pages", JSONArray().apply {
                workspace.project.pages.forEach { page -> put(JSONObject().put("id", page.id).put("name", page.name).put("sourceUri", page.sourceUri ?: "")) }
            })
            .put("measurements", JSONArray().apply {
                workspace.measurements.forEach { measurement ->
                    put(JSONObject()
                        .put("id", measurement.id)
                        .put("kind", measurement.kind.name)
                        .put("value", measurement.value)
                        .put("layerId", measurement.layerId)
                        .put("points", JSONArray().apply { measurement.points.forEach { point -> put(JSONObject().put("x", point.x).put("y", point.y)) } })
                    )
                }
            })
            .put("layers", JSONArray().apply {
                workspace.layers.forEach { layer -> put(JSONObject().put("id", layer.id).put("name", layer.name).put("color", layer.color).put("visible", layer.visible)) }
            })
        workspace.calibration?.let { root.put("calibration", JSONObject().put("factor", it.factor).put("unit", it.unit)) }
        preferences.edit().putString("workspace", root.toString()).apply()
    }

    private fun <T> JSONArray.toList(mapper: (JSONObject) -> T): List<T> = buildList {
        for (index in 0 until length()) add(mapper(getJSONObject(index)))
    }
}
