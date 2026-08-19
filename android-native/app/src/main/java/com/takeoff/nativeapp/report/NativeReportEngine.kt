package com.takeoff.nativeapp.report

import com.takeoff.nativeapp.MeasurementKind
import com.takeoff.nativeapp.NativeCalibration
import com.takeoff.nativeapp.NativeLayer
import com.takeoff.nativeapp.NativeMeasurement
import com.takeoff.nativeapp.estimation.EstimationEngine
import com.takeoff.nativeapp.estimation.NativeTemplate

data class NativeReportRow(
    val kind: MeasurementKind,
    val layer: String,
    val template: String,
    val quantity: Double,
    val unit: String,
    val cost: Double
)

object NativeReportEngine {
    fun rows(
        measurements: List<NativeMeasurement>,
        layers: List<NativeLayer>,
        templates: List<NativeTemplate>,
        calibration: NativeCalibration?
    ): List<NativeReportRow> = measurements.map { measurement ->
        val template = templates.firstOrNull { it.id == measurement.templateId }
        val quantity = physicalQuantity(measurement, calibration)
        NativeReportRow(
            kind = measurement.kind,
            layer = layers.firstOrNull { it.id == measurement.layerId }?.name ?: "طبقة غير معروفة",
            template = template?.name ?: "تسعير يدوي",
            quantity = quantity,
            unit = when (measurement.kind) {
                MeasurementKind.COUNT -> "عنصر"
                MeasurementKind.LINEAR -> calibration?.unit ?: "وحدة رسم"
                MeasurementKind.AREA -> calibration?.unit?.plus("²") ?: "وحدة² رسم"
            },
            cost = template?.let { EstimationEngine.estimate(it, quantity).cost } ?: 0.0
        )
    }

    fun toCsv(rows: List<NativeReportRow>): String = buildString {
        append("النوع,الطبقة,القالب,الكمية,الوحدة,التكلفة\n")
        rows.forEach { row ->
            append(listOf(row.kind.name, row.layer, row.template, number(row.quantity), row.unit, number(row.cost)).joinToString(",") { escape(it) })
            append('\n')
        }
        append(listOf("الإجمالي", "", "", "", "", number(rows.sumOf { it.cost })).joinToString(",") { escape(it) })
        append('\n')
    }

    private fun physicalQuantity(measurement: NativeMeasurement, calibration: NativeCalibration?): Double {
        val factor = calibration?.factor ?: 1.0
        return when (measurement.kind) {
            MeasurementKind.COUNT -> measurement.value
            MeasurementKind.LINEAR -> measurement.value * factor
            MeasurementKind.AREA -> measurement.value * factor * factor
        }
    }

    private fun number(value: Double) = "%.6f".format(java.util.Locale.ROOT, value).trimEnd('0').trimEnd('.')
    private fun escape(value: String): String = "\"${value.replace("\"", "\"\"")}\""
}
