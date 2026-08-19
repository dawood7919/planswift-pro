package com.takeoff.nativeapp.report

import com.takeoff.nativeapp.MeasurementKind
import com.takeoff.nativeapp.NativeCalibration
import com.takeoff.nativeapp.NativeLayer
import com.takeoff.nativeapp.NativeMeasurement
import com.takeoff.nativeapp.estimation.NativeTemplate
import com.takeoff.nativeapp.estimation.TemplateKind
import com.takeoff.nativeapp.measurement.PlanPoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeReportEngineTest {
    @Test
    fun `report converts calibrated area and quoted names safely`() {
        val template = NativeTemplate(1L, TemplateKind.PART, "دهان \"خارجي\"", "m²", 4.0)
        val rows = NativeReportEngine.rows(
            measurements = listOf(NativeMeasurement(1L, MeasurementKind.AREA, listOf(PlanPoint(0f, 0f)), 20.0, 1L, 1L)),
            layers = listOf(NativeLayer(1L, "واجهات", 0xFF59C3F5)),
            templates = listOf(template),
            calibration = NativeCalibration(0.5, "m")
        )
        assertEquals(5.0, rows.single().quantity, 0.00001)
        assertEquals(20.0, rows.single().cost, 0.00001)
        assertTrue(NativeReportEngine.toCsv(rows).contains("\"دهان \"\"خارجي\"\"\""))
    }
}
