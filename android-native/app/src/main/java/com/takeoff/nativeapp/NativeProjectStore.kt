package com.takeoff.nativeapp

import android.content.Context
import com.takeoff.nativeapp.measurement.PlanPoint
import com.takeoff.nativeapp.estimation.CostKind
import com.takeoff.nativeapp.estimation.NativeTemplate
import com.takeoff.nativeapp.estimation.TemplateCostItem
import com.takeoff.nativeapp.estimation.TemplateKind
import org.json.JSONArray
import org.json.JSONObject

data class StoredWorkspace(
    val project: NativeProject,
    val measurements: List<NativeMeasurement>,
    val calibration: NativeCalibration?,
    val layers: List<NativeLayer>,
    val selectedLayerId: Long,
    val templates: List<NativeTemplate>,
    val selectedTemplateId: Long?,
    val annotations: List<NativeAnnotation>
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
        val templates = root.optJSONArray("templates")?.toList { template ->
            val costItems = template.optJSONArray("costItems")?.toList { item ->
                TemplateCostItem(item.getLong("id"), CostKind.valueOf(item.getString("kind")), item.getString("name"), item.getDouble("quantityFactor"), item.getString("unit"), item.getDouble("rate"), item.optDouble("wastePercent", 0.0))
            } ?: emptyList()
            NativeTemplate(template.getLong("id"), TemplateKind.valueOf(template.getString("kind")), template.getString("name"), template.getString("unit"), template.getDouble("rate"), costItems)
        } ?: emptyList()
        val selectedTemplateId = root.optLong("selectedTemplateId", -1L).takeIf { id -> templates.any { it.id == id } }
        val annotations = root.optJSONArray("annotations")?.toList { annotation -> NativeAnnotation(annotation.getLong("id"), annotation.getString("text"), PlanPoint(annotation.getDouble("x").toFloat(), annotation.getDouble("y").toFloat()), annotation.optLong("color", 0xFFFFE082)) } ?: emptyList()
        val measurements = root.getJSONArray("measurements").toList { measurement ->
            NativeMeasurement(
                id = measurement.getLong("id"),
                kind = MeasurementKind.valueOf(measurement.getString("kind")),
                points = measurement.getJSONArray("points").toList { point -> PlanPoint(point.getDouble("x").toFloat(), point.getDouble("y").toFloat()) },
                value = measurement.getDouble("value"),
                layerId = measurement.optLong("layerId", selectedLayerId),
                templateId = measurement.optLong("templateId", -1L).takeIf { it >= 0 },
                multiplier = measurement.optDouble("multiplier", 1.0)
            )
        }
        val calibration = root.optJSONObject("calibration")?.let { NativeCalibration(it.getDouble("factor"), it.getString("unit")) }
        StoredWorkspace(project, measurements, calibration, layers, selectedLayerId, templates, selectedTemplateId, annotations)
    }.getOrNull()

    fun save(workspace: StoredWorkspace) {
        val root = JSONObject()
            .put("projectId", workspace.project.id)
            .put("projectName", workspace.project.name)
            .put("selectedLayerId", workspace.selectedLayerId)
            .put("selectedTemplateId", workspace.selectedTemplateId ?: -1L)
            .put("annotations", JSONArray().apply { workspace.annotations.forEach { annotation -> put(JSONObject().put("id", annotation.id).put("text", annotation.text).put("x", annotation.point.x).put("y", annotation.point.y).put("color", annotation.color)) } })
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
                        .put("templateId", measurement.templateId ?: -1L)
                        .put("multiplier", measurement.multiplier)
                        .put("points", JSONArray().apply { measurement.points.forEach { point -> put(JSONObject().put("x", point.x).put("y", point.y)) } })
                    )
                }
            })
            .put("layers", JSONArray().apply {
                workspace.layers.forEach { layer -> put(JSONObject().put("id", layer.id).put("name", layer.name).put("color", layer.color).put("visible", layer.visible)) }
            })
            .put("templates", JSONArray().apply {
                workspace.templates.forEach { template -> put(JSONObject().put("id", template.id).put("kind", template.kind.name).put("name", template.name).put("unit", template.unit).put("rate", template.rate).put("costItems", JSONArray().apply {
                    template.costItems.forEach { item -> put(JSONObject().put("id", item.id).put("kind", item.kind.name).put("name", item.name).put("quantityFactor", item.quantityFactor).put("unit", item.unit).put("rate", item.rate).put("wastePercent", item.wastePercent)) }
                })) }
            })
        workspace.calibration?.let { root.put("calibration", JSONObject().put("factor", it.factor).put("unit", it.unit)) }
        preferences.edit().putString("workspace", root.toString()).apply()
    }

    private fun <T> JSONArray.toList(mapper: (JSONObject) -> T): List<T> = buildList {
        for (index in 0 until length()) add(mapper(getJSONObject(index)))
    }
}
