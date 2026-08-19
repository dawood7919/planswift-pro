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
}
