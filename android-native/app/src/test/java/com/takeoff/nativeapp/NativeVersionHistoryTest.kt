package com.takeoff.nativeapp

import com.takeoff.nativeapp.measurement.PlanPoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeVersionHistoryTest {
    @Test
    fun `restore plan preserves current workspace as a backup before applying target version`() {
        val current = workspace("الحالة الحالية", 11L)
        val targetWorkspace = workspace("إصدار مرجعي", 22L)
        val target = NativeVersionHistory.create(3L, "قبل التعديل", targetWorkspace, 100L)

        val plan = NativeVersionHistory.prepareRestore(current, target, backupId = 4L, createdAtEpochMillis = 200L)

        assertEquals("إصدار مرجعي", plan.restoredWorkspace.project.name)
        assertEquals("الحالة الحالية", plan.backup.workspace.project.name)
        assertEquals("نسخة احتياطية قبل استعادة قبل التعديل", plan.backup.label)
        assertTrue(plan.backup.createdAtEpochMillis > target.createdAtEpochMillis)
    }

    private fun workspace(name: String, measurementId: Long) = StoredWorkspace(
        project = NativeProject(1L, name, listOf(NativeProjectPage(1L, "المخطط"))),
        measurements = listOf(NativeMeasurement(measurementId, MeasurementKind.LINEAR, listOf(PlanPoint(0f, 0f), PlanPoint(10f, 0f)), 10.0, 1L)),
        calibration = NativeCalibration(1.0, "m"),
        layers = listOf(NativeLayer(1L, "قياسات عامة", 0xFF59C3F5)),
        selectedLayerId = 1L,
        templates = emptyList(),
        selectedTemplateId = null,
        annotations = emptyList()
    )
}
