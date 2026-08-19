package com.takeoff.nativeapp

data class NativeProjectVersion(
    val id: Long,
    val label: String,
    val createdAtEpochMillis: Long,
    val workspace: StoredWorkspace
)

data class NativeRestorePlan(val backup: NativeProjectVersion, val restoredWorkspace: StoredWorkspace)

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
}
