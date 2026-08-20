package com.takeoff.nativeapp.ui

import com.takeoff.nativeapp.NativeTool

data class WorkspaceSummary(
    val toolLabel: String,
    val measurementsLabel: String,
    val calibrationLabel: String
)

fun workspaceSummary(
    tool: NativeTool,
    measurementCount: Int,
    calibrationUnit: String?
): WorkspaceSummary = WorkspaceSummary(
    toolLabel = tool.label,
    measurementsLabel = if (measurementCount == 0) "لا توجد قياسات بعد" else "$measurementCount عنصر قياس",
    calibrationLabel = calibrationUnit?.let { "معاير · $it" } ?: "غير معاير"
)
