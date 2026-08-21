package com.takeoff.nativeapp.ui

import com.takeoff.nativeapp.MeasurementKind
import com.takeoff.nativeapp.NativeTool
import org.junit.Assert.assertEquals
import org.junit.Test

class WorkspaceOverlaysTest {
    @Test
    fun `unit label follows the page calibration unit`() {
        assertEquals("m", unitLabelFor(MeasurementKind.LINEAR, "m"))
        assertEquals("m²", unitLabelFor(MeasurementKind.AREA, "m"))
        assertEquals("ft²", unitLabelFor(MeasurementKind.ROOF_AREA, "ft"))
        assertEquals("m³", unitLabelFor(MeasurementKind.VOLUME, "m"))
        assertEquals("عدد", unitLabelFor(MeasurementKind.COUNT, "m"))
    }

    @Test
    fun `an uncalibrated page reports no unit rather than a misleading one`() {
        assertEquals("", unitLabelFor(MeasurementKind.AREA, null))
        assertEquals("", unitLabelFor(MeasurementKind.LINEAR, null))
    }

    @Test
    fun `each tool declares the points its shape needs`() {
        assertEquals(1, minimumPointsFor(NativeTool.COUNT))
        assertEquals(2, minimumPointsFor(NativeTool.LINEAR))
        assertEquals(2, minimumPointsFor(NativeTool.SEGMENT))
        assertEquals(3, minimumPointsFor(NativeTool.AREA))
        assertEquals(3, minimumPointsFor(NativeTool.ROOF_AREA))
        assertEquals(3, minimumPointsFor(NativeTool.VOLUME))
        assertEquals(3, minimumPointsFor(NativeTool.CUTOUT))
        assertEquals(0, minimumPointsFor(NativeTool.PAN))
    }

    @Test
    fun `large quantities drop the decimals that add no information`() {
        assertEquals("12.35", formatQuantity(12.345))
        assertEquals("0.50", formatQuantity(0.5))
        assertEquals("1234", formatQuantity(1234.4))
    }

    @Test
    fun `every measurement kind maps to its own hue and never to the money accent`() {
        val colors = MeasurementKind.entries.map { takeoffKindColor(it) }
        assertEquals(MeasurementKind.entries.size, colors.toSet().size)
        assertEquals(false, colors.contains(TakeoffAccent))
    }
}
