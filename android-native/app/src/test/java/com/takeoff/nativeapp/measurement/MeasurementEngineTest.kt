package com.takeoff.nativeapp.measurement

import org.junit.Assert.assertEquals
import org.junit.Test

class MeasurementEngineTest {
    @Test
    fun `polyline length is deterministic`() {
        val value = MeasurementEngine.polylineLength(listOf(PlanPoint(0f, 0f), PlanPoint(3f, 4f), PlanPoint(6f, 8f)))
        assertEquals(10.0, value, 0.00001)
    }

    @Test
    fun `polygon area closes the shape deterministically`() {
        val value = MeasurementEngine.polygonArea(listOf(PlanPoint(0f, 0f), PlanPoint(5f, 0f), PlanPoint(5f, 4f), PlanPoint(0f, 4f)))
        assertEquals(20.0, value, 0.00001)
    }

    @Test
    fun `calibration scales length and area without rounding`() {
        val factor = MeasurementEngine.scaleFactor(drawingDistance = 20.0, knownDistance = 5.0)
        assertEquals(0.25, factor!!, 0.00001)
        assertEquals(3.0, MeasurementEngine.calibratedLength(12.0, factor), 0.00001)
        assertEquals(2.5, MeasurementEngine.calibratedArea(40.0, factor), 0.00001)
    }

    @Test
    fun `calibration rejects zero and negative values`() {
        assertEquals(null, MeasurementEngine.scaleFactor(0.0, 5.0))
        assertEquals(null, MeasurementEngine.scaleFactor(10.0, -5.0))
    }

    @Test
    fun `roof area and volume use deterministic physical factors`() {
        assertEquals(11.1803398875, MeasurementEngine.roofArea(10.0, 1.0, 2.0), 0.00001)
        assertEquals(30.0, MeasurementEngine.volume(20.0, 1.5), 0.00001)
    }
}
