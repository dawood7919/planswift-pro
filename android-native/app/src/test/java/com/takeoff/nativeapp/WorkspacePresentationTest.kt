package com.takeoff.nativeapp

import com.takeoff.nativeapp.ui.workspaceSummary
import org.junit.Assert.assertEquals
import org.junit.Test

class WorkspacePresentationTest {
    @Test
    fun everyToolbarToolHasAVisibleAndUniqueArabicLabel() {
        val labels = NativeTool.entries.map { it.label }

        org.junit.Assert.assertEquals(NativeTool.entries.size, labels.distinct().size)
        org.junit.Assert.assertTrue(labels.all { it.isNotBlank() && it.any(Char::isLetter) })
    }

    @Test
    fun summaryMakesEmptyWorkspaceAndMissingCalibrationExplicit() {
        val summary = workspaceSummary(NativeTool.AREA, 0, null)

        assertEquals("مساحة", summary.toolLabel)
        assertEquals("لا توجد قياسات بعد", summary.measurementsLabel)
        assertEquals("غير معاير", summary.calibrationLabel)
    }

    @Test
    fun summaryShowsCountAndCalibrationUnitForActiveWorkspace() {
        val summary = workspaceSummary(NativeTool.VOLUME, 4, "m")

        assertEquals("حجم", summary.toolLabel)
        assertEquals("4 عنصر قياس", summary.measurementsLabel)
        assertEquals("معاير · m", summary.calibrationLabel)
    }
}
