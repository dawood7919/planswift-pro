package com.takeoff.nativeapp.measurement

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
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

    @Test
    fun `cutouts are subtracted from an outer polygon`() {
        val outer = listOf(PlanPoint(0f, 0f), PlanPoint(10f, 0f), PlanPoint(10f, 10f), PlanPoint(0f, 10f))
        val cutout = listOf(PlanPoint(2f, 2f), PlanPoint(4f, 2f), PlanPoint(4f, 4f), PlanPoint(2f, 4f))
        assertEquals(96.0, MeasurementEngine.areaWithCutouts(outer, listOf(cutout)), 0.00001)
    }

    @Test
    fun `cutout validation accepts only simple inner loops without overlap`() {
        val outer = listOf(PlanPoint(0f, 0f), PlanPoint(10f, 0f), PlanPoint(10f, 10f), PlanPoint(0f, 10f))
        val existing = listOf(PlanPoint(2f, 2f), PlanPoint(4f, 2f), PlanPoint(4f, 4f), PlanPoint(2f, 4f))
        val valid = listOf(PlanPoint(6f, 6f), PlanPoint(8f, 6f), PlanPoint(8f, 8f), PlanPoint(6f, 8f))
        val outside = listOf(PlanPoint(9f, 9f), PlanPoint(11f, 9f), PlanPoint(11f, 11f), PlanPoint(9f, 11f))
        val overlapping = listOf(PlanPoint(3f, 3f), PlanPoint(5f, 3f), PlanPoint(5f, 5f), PlanPoint(3f, 5f))

        assertTrue(MeasurementEngine.canAddCutout(outer, listOf(existing), valid))
        assertFalse(MeasurementEngine.canAddCutout(outer, listOf(existing), outside))
        assertFalse(MeasurementEngine.canAddCutout(outer, listOf(existing), overlapping))
    }

    @Test
    fun `cutouts proportionally update sloped area value`() {
        val slopedOuter = MeasurementEngine.roofArea(flatArea = 100.0, rise = 1.0, run = 2.0)
        val netValue = MeasurementEngine.adjustAreaValueProportionally(
            originalOuterArea = 100.0,
            originalMeasuredValue = slopedOuter,
            adjustedFlatArea = 96.0
        )
        assertEquals(MeasurementEngine.roofArea(flatArea = 96.0, rise = 1.0, run = 2.0), netValue, 0.00001)
    }
}
