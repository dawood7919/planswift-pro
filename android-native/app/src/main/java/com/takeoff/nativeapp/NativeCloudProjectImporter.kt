package com.takeoff.nativeapp

import com.takeoff.nativeapp.measurement.MeasurementEngine
import com.takeoff.nativeapp.measurement.PlanPoint
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs

data class ImportedNativeWorkspace(
    val project: NativeProject,
    val measurements: List<NativeMeasurement>,
    val calibration: NativeCalibration?,
    val activePageId: Long
)

data class CloudProjectPoint(val x: Double, val y: Double)
data class CloudProjectPage(
    val sourceId: String,
    val name: String,
    val scaleDrawingDistance: String?,
    val scaleWorldDistance: String?,
    val scaleUnit: String?,
    val pageWidth: Double? = null,
    val pageHeight: Double? = null,
    val pageRotation: Int = 0,
    val geometrySpace: String = "LEGACY_VIEWBOX"
)
data class CloudProjectGeometry(val points: List<CloudProjectPoint> = emptyList(), val rings: List<List<CloudProjectPoint>> = emptyList(), val marks: List<CloudProjectPoint> = emptyList(), val slopeRise: Double? = null, val slopeRun: Double? = null, val depth: Double? = null)
data class CloudProjectItem(val pageSourceId: String, val kind: String, val geometry: CloudProjectGeometry, val multiplier: String)
data class CloudProjectFileData(val projectName: String, val pages: List<CloudProjectPage>, val items: List<CloudProjectItem>)

object NativeCloudProjectImporter {
    fun import(source: String): ImportedNativeWorkspace {
        require(source.length <= MAX_PROJECT_FILE_BYTES) { "ملف المشروع أكبر من الحد الآمن للتطبيق." }
        return import(parse(source))
    }

    fun import(file: CloudProjectFileData): ImportedNativeWorkspace {
        val projectName = file.projectName.trim().takeIf { it.isNotEmpty() } ?: error("اسم المشروع غير صالح.")
        require(file.pages.size in 1..MAX_PAGES) { "عدد صفحات المشروع غير صالح." }
        require(file.items.size <= MAX_ITEMS) { "عدد عناصر القياس يتجاوز الحد الآمن." }
        val pageIds = mutableMapOf<String, Long>()
        val pages = file.pages.mapIndexed { index, page ->
            val sourceId = page.sourceId.trim()
            require(sourceId.isNotEmpty() && sourceId !in pageIds) { "معرّف الصفحة غير صالح." }
            val id = index.toLong() + 1L
            pageIds[sourceId] = id
            NativeProjectPage(id, page.name.trim().takeIf { it.isNotEmpty() } ?: error("اسم الصفحة غير صالح."))
        }
        val measurements = file.items.mapIndexed { index, item -> item.toNativeMeasurement(index.toLong() + 1L, pageIds) }
        val projectId = (abs("$projectName:${pages.joinToString { it.name }}".hashCode().toLong()) + 1L).coerceAtLeast(1L)
        return ImportedNativeWorkspace(NativeProject(projectId, projectName, pages), measurements, file.pages.firstCalibration(), pages.first().id)
    }

    private fun parse(source: String): CloudProjectFileData {
        val root = JSONObject(source)
        val version = root.getInt("version")
        require(root.optString("format") == "takeoff-project" && version in setOf(1, 2)) { "تنسيق ملف المشروع غير مدعوم." }
        val projectName = root.getJSONObject("project").getString("name")
        val pages = root.getJSONArray("pages").toCloudPages(version)
        val items = root.getJSONArray("items").toCloudItems()
        return CloudProjectFileData(projectName, pages, items)
    }

    private fun JSONArray.toCloudPages(version: Int): List<CloudProjectPage> = buildList {
        for (index in 0 until length()) {
            val page = getJSONObject(index)
            val geometrySpace = if (version == 1) "LEGACY_VIEWBOX" else page.getString("geometrySpace")
            require(geometrySpace == "LEGACY_VIEWBOX" || geometrySpace == "PAGE_POINTS") { "مساحة إحداثيات الصفحة غير صالحة." }
            val pageWidth = page.optString("pageWidth").toDoubleOrNull()
            val pageHeight = page.optString("pageHeight").toDoubleOrNull()
            val pageRotation = if (version == 1) 0 else page.getInt("pageRotation")
            if (geometrySpace == "PAGE_POINTS") require(pageWidth != null && pageHeight != null && pageWidth.isFinite() && pageHeight.isFinite() && pageWidth > 0 && pageHeight > 0) { "أبعاد صفحة PDF غير صالحة." }
            require(pageRotation in setOf(0, 90, 180, 270)) { "دوران صفحة PDF غير صالح." }
            add(CloudProjectPage(
                sourceId = page.getString("sourceId"),
                name = page.getString("name"),
                scaleDrawingDistance = page.optString("scaleDrawingDistance").ifBlank { null },
                scaleWorldDistance = page.optString("scaleWorldDistance").ifBlank { null },
                scaleUnit = page.optString("scaleUnit").ifBlank { null },
                pageWidth = pageWidth,
                pageHeight = pageHeight,
                pageRotation = pageRotation,
                geometrySpace = geometrySpace
            ))
        }
    }

    private fun JSONArray.toCloudItems(): List<CloudProjectItem> = buildList {
        for (index in 0 until length()) {
            val item = getJSONObject(index)
            val geometry = item.getJSONObject("geometry")
            add(CloudProjectItem(
                pageSourceId = item.getString("pageSourceId"),
                kind = item.getString("kind"),
                geometry = CloudProjectGeometry(
                    points = geometry.optJSONArray("points")?.toCloudPoints().orEmpty(),
                    rings = geometry.optJSONArray("rings")?.toCloudRings().orEmpty(),
                    marks = geometry.optJSONArray("marks")?.toCloudPoints().orEmpty(),
                    slopeRise = geometry.optionalFiniteDouble("slopeRise"),
                    slopeRun = geometry.optionalFiniteDouble("slopeRun"),
                    depth = geometry.optionalFiniteDouble("depth")
                ),
                multiplier = item.optString("multiplier", "1")
            ))
        }
    }

    private fun JSONArray.toCloudPoints(): List<CloudProjectPoint> = buildList {
        for (index in 0 until length()) {
            val point = getJSONObject(index)
            val x = point.getDouble("x")
            val y = point.getDouble("y")
            require(x.isFinite() && y.isFinite()) { "نقطة قياس غير صالحة." }
            add(CloudProjectPoint(x, y))
        }
    }

    private fun JSONArray.toCloudRings(): List<List<CloudProjectPoint>> = buildList {
        for (index in 0 until length()) add(getJSONArray(index).toCloudPoints())
    }

    private fun JSONObject.optionalFiniteDouble(key: String): Double? =
        if (!has(key)) null else getDouble(key).takeIf { it.isFinite() }

    private fun CloudProjectItem.toNativeMeasurement(id: Long, pageIds: Map<String, Long>): NativeMeasurement {
        require(pageSourceId in pageIds) { "عنصر القياس مرتبط بصفحة غير صالحة." }
        val kind = when (kind) {
            "COUNT" -> MeasurementKind.COUNT
            "LINEAR", "SEGMENT" -> MeasurementKind.LINEAR
            "AREA" -> MeasurementKind.AREA
            "ROOF_AREA" -> MeasurementKind.ROOF_AREA
            "VOLUME" -> MeasurementKind.VOLUME
            else -> error("نوع قياس غير مدعوم في Android.")
        }
        val (points, cutouts) = if (kind in setOf(MeasurementKind.AREA, MeasurementKind.ROOF_AREA, MeasurementKind.VOLUME)) {
            require(geometry.rings.isNotEmpty()) { "قياس المساحة يحتاج حلقة أساسية." }
            val parsedRings = geometry.rings.map { ring -> ring.toPlanPoints() }
            val outer = parsedRings.first()
            require(outer.size >= 3 && MeasurementEngine.polygonArea(outer) > EPSILON) { "مضلع المساحة غير صالح." }
            outer to parsedRings.drop(1)
        } else {
            val sourcePoints = if (kind == MeasurementKind.COUNT) (geometry.marks.ifEmpty { geometry.points }) else geometry.points
            sourcePoints.toPlanPoints() to emptyList()
        }
        val value = when (this.kind) {
            "COUNT" -> points.size.toDouble()
            "LINEAR" -> MeasurementEngine.polylineLength(points)
            "SEGMENT" -> {
                require(points.size >= 2 && points.size % 2 == 0) { "المقاطع تتطلب أزواج نقاط." }
                points.chunked(2).sumOf { pair -> MeasurementEngine.polylineLength(pair) }
            }
            "AREA" -> MeasurementEngine.areaWithCutouts(points, cutouts)
            "ROOF_AREA" -> MeasurementEngine.roofArea(MeasurementEngine.areaWithCutouts(points, cutouts), geometry.slopeRise ?: error("ميل السطح غير صالح."), geometry.slopeRun ?: error("ميل السطح غير صالح."))
            "VOLUME" -> MeasurementEngine.volume(MeasurementEngine.areaWithCutouts(points, cutouts), geometry.depth ?: error("عمق الحجم غير صالح."))
            else -> error("نوع قياس غير مدعوم في Android.")
        }
        val multiplier = multiplier.toDoubleOrNull()
        require(multiplier != null && multiplier.isFinite() && multiplier > 0) { "عامل تكرار القياس غير صالح." }
        return NativeMeasurement(id, kind, points, value, DEFAULT_LAYER_ID, multiplier = multiplier, cutouts = cutouts)
    }

    private fun List<CloudProjectPoint>.toPlanPoints(): List<PlanPoint> = map { point ->
        require(point.x.isFinite() && point.y.isFinite()) { "نقطة قياس غير صالحة." }
        PlanPoint(point.x.toFloat(), point.y.toFloat())
    }

    private fun List<CloudProjectPage>.firstCalibration(): NativeCalibration? {
        for (page in this) {
            val drawingDistance = page.scaleDrawingDistance?.toDoubleOrNull()
            val worldDistance = page.scaleWorldDistance?.toDoubleOrNull()
            val unit = page.scaleUnit
            if (drawingDistance != null && worldDistance != null && drawingDistance > 0 && worldDistance > 0 && unit != null && unit in VALID_UNITS) {
                return NativeCalibration(worldDistance / drawingDistance, unit)
            }
        }
        return null
    }

    private const val DEFAULT_LAYER_ID = 1L
    private const val MAX_PROJECT_FILE_BYTES = 5_000_000
    private const val MAX_PAGES = 100
    private const val MAX_ITEMS = 10_000
    private const val EPSILON = 0.00001
    private val VALID_UNITS = setOf("m", "ft", "cm", "in")
}
