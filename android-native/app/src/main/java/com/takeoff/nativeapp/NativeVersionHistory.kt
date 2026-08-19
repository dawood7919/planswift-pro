package com.takeoff.nativeapp

data class NativeProjectVersion(
    val id: Long,
    val label: String,
    val createdAtEpochMillis: Long,
    val workspace: StoredWorkspace
)

data class NativeRestorePlan(val backup: NativeProjectVersion, val restoredWorkspace: StoredWorkspace)

data class NativeVersionComparison(
    val referenceLabel: String,
    val addedMeasurements: Int,
    val removedMeasurements: Int,
    val changedMeasurements: Int,
    val addedAnnotations: Int,
    val removedAnnotations: Int,
    val changedAnnotations: Int,
    val changedPages: Int
) {
    val totalChanges: Int get() = addedMeasurements + removedMeasurements + changedMeasurements + addedAnnotations + removedAnnotations + changedAnnotations + changedPages
}

object NativeVersionHistory {
    fun create(id: Long, label: String, workspace: StoredWorkspace, createdAtEpochMillis: Long): NativeProjectVersion {
        val normalized = label.trim().take(160)
        require(normalized.isNotEmpty()) { "اكتب اسماً للإصدار." }
        return NativeProjectVersion(id, normalized, createdAtEpochMillis, workspace)
    }

    fun prepareRestore(current: StoredWorkspace, target: NativeProjectVersion, backupId: Long, createdAtEpochMillis: Long): NativeRestorePlan {
        val backup = create(backupId, "نسخة احتياطية قبل استعادة ${target.label}", current, createdAtEpochMillis)
        return NativeRestorePlan(backup, target.workspace)
    }

    fun compare(current: StoredWorkspace, reference: NativeProjectVersion): NativeVersionComparison {
        val referenceMeasurements = reference.workspace.measurements.associateBy { it.id }
        val currentMeasurements = current.measurements.associateBy { it.id }
        val referenceAnnotations = reference.workspace.annotations.associateBy { it.id }
        val currentAnnotations = current.annotations.associateBy { it.id }
        val referencePages = reference.workspace.project.pages.associateBy { it.id }
        val currentPages = current.project.pages.associateBy { it.id }
        return NativeVersionComparison(
            referenceLabel = reference.label,
            addedMeasurements = (currentMeasurements.keys - referenceMeasurements.keys).size,
            removedMeasurements = (referenceMeasurements.keys - currentMeasurements.keys).size,
            changedMeasurements = (currentMeasurements.keys intersect referenceMeasurements.keys).count { id -> currentMeasurements[id] != referenceMeasurements[id] },
            addedAnnotations = (currentAnnotations.keys - referenceAnnotations.keys).size,
            removedAnnotations = (referenceAnnotations.keys - currentAnnotations.keys).size,
            changedAnnotations = (currentAnnotations.keys intersect referenceAnnotations.keys).count { id -> currentAnnotations[id] != referenceAnnotations[id] },
            changedPages = ((currentPages.keys union referencePages.keys)).count { id -> currentPages[id] != referencePages[id] }
        )
    }
}
