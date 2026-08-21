package com.takeoff.nativeapp

import android.app.Application
import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import java.io.File
import android.view.MotionEvent
import androidx.compose.ui.geometry.Offset
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.takeoff.nativeapp.estimation.NativeTemplate
import com.takeoff.nativeapp.estimation.TemplateKind
import com.takeoff.nativeapp.estimation.CostKind
import com.takeoff.nativeapp.estimation.TemplateCostItem
import com.takeoff.nativeapp.measurement.MeasurementEngine
import com.takeoff.nativeapp.measurement.PlanPoint
import com.takeoff.nativeapp.report.NativeReportEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class NativeTool(val label: String) {
    PAN("تحريك"),
    CALIBRATE("معايرة"),
    COUNT("عد"),
    SEGMENT("مقطع"),
    LINEAR("طول"),
    AREA("مساحة"),
    ROOF_AREA("سطح مائل"),
    VOLUME("حجم"),
    CUTOUT("فتحة"),
    NOTE("ملاحظة")
}

enum class MeasurementKind { COUNT, LINEAR, AREA, ROOF_AREA, VOLUME }

data class NativeProjectPage(val id: Long, val name: String, val sourceUri: String? = null)

data class NativeProject(val id: Long, val name: String, val pages: List<NativeProjectPage>)

/**
 * Layer hues, matching the design tokens in ui/TakeoffUiPrimitives.kt.
 * Orange is deliberately absent: it marks money, never a measurement.
 */
val TAKEOFF_LAYER_COLORS = longArrayOf(0xFF22D3EE, 0xFFF5A524, 0xFFA78BFA, 0xFF4ADE80, 0xFF7DD3FC)

data class NativeLayer(val id: Long, val name: String, val color: Long, val visible: Boolean = true)

data class NativeMeasurement(
    val id: Long,
    val kind: MeasurementKind,
    val points: List<PlanPoint>,
    val value: Double,
    val layerId: Long,
    val templateId: Long? = null,
    val multiplier: Double = 1.0,
    val cutouts: List<List<PlanPoint>> = emptyList()
)

data class NativeCalibration(val factor: Double, val unit: String)

data class NativeAnnotation(val id: Long, val text: String, val point: PlanPoint, val color: Long = 0xFFFBBF24)

data class TakeoffUiState(
    val pdfBitmap: Bitmap? = null,
    val pdfLabel: String? = null,
    val referencePdfBitmap: Bitmap? = null,
    val referencePdfLabel: String? = null,
    val isReferenceOverlayVisible: Boolean = false,
    val selectedTool: NativeTool = NativeTool.PAN,
    val pan: Offset = Offset.Zero,
    val zoom: Float = 1f,
    val activePoints: List<PlanPoint> = emptyList(),
    val calibrationPoints: List<PlanPoint> = emptyList(),
    val knownDistance: String = "1",
    val scaleUnit: String = "m",
    val roofRise: String = "",
    val roofRun: String = "",
    val volumeDepth: String = "",
    val calibration: NativeCalibration? = null,
    val layers: List<NativeLayer> = listOf(NativeLayer(1L, "قياسات عامة", TAKEOFF_LAYER_COLORS[0])),
    val selectedLayerId: Long = 1L,
    val templates: List<NativeTemplate> = emptyList(),
    val selectedTemplateId: Long? = null,
    val multiplierInput: String = "1",
    val measurements: List<NativeMeasurement> = emptyList(),
    val selectedMeasurementIds: Set<Long> = emptySet(),
    val cutoutTargetId: Long? = null,
    val annotations: List<NativeAnnotation> = emptyList(),
    val cloudEndpoint: String = NativeConnectionStore.DEFAULT_ENDPOINT,
    val cloudProjects: List<NativeCloudProject> = emptyList(),
    val cloudDocuments: List<NativeCloudDocument> = emptyList(),
    val cloudDocumentProjectId: String? = null,
    val cloudReviews: List<NativeCloudReview> = emptyList(),
    val cloudReviewProjectId: String? = null,
    val cloudStatus: String = "غير مرتبط بالمنصة",
    val cloudError: String? = null,
    val isRefreshingCloudProjects: Boolean = false,
    val isDownloadingCloudPdf: Boolean = false,
    val versions: List<NativeProjectVersion> = emptyList(),
    val versionComparison: NativeVersionComparison? = null,
    val noteText: String = "",
    val project: NativeProject = NativeProject(id = 1L, name = "مشروع محلي جديد", pages = emptyList()),
    val activePageId: Long? = null,
    val inputSource: String = "لم يبدأ إدخال",
    val isLoadingPlan: Boolean = false,
    val loadError: String? = null
)

class TakeoffViewModel(application: Application) : AndroidViewModel(application) {
    private val _state = MutableStateFlow(TakeoffUiState())
    val state: StateFlow<TakeoffUiState> = _state.asStateFlow()
    private val localStore = NativeProjectStore(application)
    private val connectionStore = NativeConnectionStore(application)
    private val cloudApi = NativeCloudApi()
    private var lastScreenPoint: Offset? = null
    private var activePointerId: Int? = null
    private var lastPinchDistance: Float? = null
    private var isPinching = false
    private var nextMeasurementId = 1L
    private var nextPageId = 1L
    private var nextLayerId = 2L
    private var nextTemplateId = 1L
    private var nextCostItemId = 1L
    private var nextAnnotationId = 1L
    private var nextVersionId = 1L

    init {
        val versions = localStore.loadVersions()
        localStore.load()?.let { stored ->
            _state.value = _state.value.copy(project = stored.project, measurements = stored.measurements, calibration = stored.calibration, layers = stored.layers, selectedLayerId = stored.selectedLayerId, templates = stored.templates, selectedTemplateId = stored.selectedTemplateId, activePageId = stored.project.pages.lastOrNull()?.id, annotations = stored.annotations, versions = versions)
            nextMeasurementId = (stored.measurements.maxOfOrNull { it.id } ?: 0L) + 1L
            nextPageId = (stored.project.pages.maxOfOrNull { it.id } ?: 0L) + 1L
            nextLayerId = (stored.layers.maxOfOrNull { it.id } ?: 0L) + 1L
            nextTemplateId = (stored.templates.maxOfOrNull { it.id } ?: 0L) + 1L
            nextCostItemId = (stored.templates.flatMap { it.costItems }.maxOfOrNull { it.id } ?: 0L) + 1L
            nextAnnotationId = (stored.annotations.maxOfOrNull { it.id } ?: 0L) + 1L
        }
        nextVersionId = (versions.maxOfOrNull { it.id } ?: 0L) + 1L
        if (_state.value.versions.isEmpty() && versions.isNotEmpty()) _state.update { it.copy(versions = versions) }
        connectionStore.load()?.let { connection ->
            _state.update {
                it.copy(
                    cloudEndpoint = connection.endpoint,
                    cloudProjects = connection.cachedProjects,
                    cloudStatus = if (connection.isExpired()) "انتهت جلسة الجهاز؛ ما زالت قائمة المشاريع المحلية متاحة" else "جلسة الجهاز محفوظة",
                    cloudError = if (connection.isExpired()) "أنشئ رمز ربط جديداً من المنصة للمتابعة." else null
                )
            }
        }
    }

    fun selectTool(tool: NativeTool) {
        _state.update { current ->
            val hasEligibleCutoutTarget = current.cutoutTargetId?.let { targetId ->
                current.measurements.any { it.id == targetId && it.kind in setOf(MeasurementKind.AREA, MeasurementKind.ROOF_AREA) }
            } == true
            if (tool == NativeTool.CUTOUT && !hasEligibleCutoutTarget) {
                current.copy(activePoints = emptyList(), inputSource = "اختر مساحة أو سطحاً مائلاً كهدف للفتحات أولاً")
            } else {
                current.copy(selectedTool = tool, activePoints = emptyList())
            }
        }
    }

    fun clearMeasurements() {
        _state.update { it.copy(measurements = emptyList(), activePoints = emptyList(), cutoutTargetId = null) }
        persistWorkspace()
    }

    fun undoLastMeasurement() {
        _state.update { current -> current.copy(measurements = current.measurements.dropLast(1)) }
        persistWorkspace()
    }

    fun deleteMeasurement(measurementId: Long) {
        _state.update { current ->
            current.copy(
                measurements = current.measurements.filterNot { it.id == measurementId },
                selectedMeasurementIds = current.selectedMeasurementIds - measurementId,
                cutoutTargetId = current.cutoutTargetId?.takeIf { it != measurementId }
            )
        }
        persistWorkspace()
    }

    fun duplicateMeasurement(measurementId: Long) {
        val source = _state.value.measurements.firstOrNull { it.id == measurementId } ?: return
        val copy = source.copy(
            id = nextMeasurementId++,
            points = source.points.map { point -> PlanPoint(point.x + 12f, point.y + 12f) },
            cutouts = source.cutouts.map { loop -> loop.map { point -> PlanPoint(point.x + 12f, point.y + 12f) } }
        )
        _state.update { it.copy(measurements = it.measurements + copy, inputSource = "نُسخ عنصر القياس بإزاحة واضحة") }
        persistWorkspace()
    }

    fun toggleMeasurementSelection(measurementId: Long) {
        _state.update { current ->
            val selected = if (measurementId in current.selectedMeasurementIds) current.selectedMeasurementIds - measurementId else current.selectedMeasurementIds + measurementId
            current.copy(selectedMeasurementIds = selected)
        }
    }

    fun deleteSelectedMeasurements() {
        val selected = _state.value.selectedMeasurementIds
        if (selected.isEmpty()) return
        _state.update { current ->
            current.copy(
                measurements = current.measurements.filterNot { it.id in selected },
                selectedMeasurementIds = emptySet(),
                cutoutTargetId = current.cutoutTargetId?.takeIf { it !in selected }
            )
        }
        persistWorkspace()
    }

    fun duplicateSelectedMeasurements() {
        val selected = _state.value.selectedMeasurementIds
        if (selected.isEmpty()) return
        val copies = _state.value.measurements.filter { it.id in selected }.map { source ->
            source.copy(
                id = nextMeasurementId++,
                points = source.points.map { point -> PlanPoint(point.x + 12f, point.y + 12f) },
                cutouts = source.cutouts.map { loop -> loop.map { point -> PlanPoint(point.x + 12f, point.y + 12f) } }
            )
        }
        _state.update { it.copy(measurements = it.measurements + copies, inputSource = "نُسخت مجموعة القياسات بإزاحة واضحة") }
        persistWorkspace()
    }

    fun setKnownDistance(value: String) {
        _state.update { it.copy(knownDistance = value) }
    }

    fun setScaleUnit(unit: String) {
        _state.update { it.copy(scaleUnit = unit) }
    }

    fun setRoofRise(value: String) {
        _state.update { it.copy(roofRise = value) }
    }

    fun setRoofRun(value: String) {
        _state.update { it.copy(roofRun = value) }
    }

    fun setVolumeDepth(value: String) {
        _state.update { it.copy(volumeDepth = value) }
    }

    fun setMultiplierInput(value: String) {
        _state.update { it.copy(multiplierInput = value) }
    }

    fun setNoteText(value: String) {
        _state.update { it.copy(noteText = value.take(400)) }
    }

    fun setCloudEndpoint(value: String) {
        _state.update { it.copy(cloudEndpoint = value.take(500), cloudError = null) }
    }

    fun connectCloud(endpoint: String, token: String) {
        val normalizedEndpoint = connectionStore.normalizeEndpoint(endpoint)
        if (normalizedEndpoint == null) {
            _state.update { it.copy(cloudError = "استخدم رابط HTTPS صحيحاً للمنصة.") }
            return
        }
        val normalizedToken = token.trim()
        if (normalizedToken.length < 32) {
            _state.update { it.copy(cloudError = "ألصق رمز ربط Android الصادر من المنصة.") }
            return
        }
        val connection = NativeDeviceConnection(
            endpoint = normalizedEndpoint,
            token = normalizedToken,
            expiresAtEpochMillis = System.currentTimeMillis() + 7L * 24L * 60L * 60L * 1000L,
            cachedProjects = _state.value.cloudProjects
        )
        connectionStore.save(connection)
        _state.update { it.copy(cloudEndpoint = normalizedEndpoint, cloudStatus = "حُفظ رمز الجهاز؛ جارٍ فحص المشاريع", cloudError = null) }
        refreshCloudProjects()
    }

    fun refreshCloudProjects() {
        val connection = connectionStore.load()
        if (connection == null) {
            _state.update { it.copy(cloudError = "اربط الجهاز أولاً برمز من منصة Takeoff.") }
            return
        }
        if (connection.isExpired()) {
            _state.update { it.copy(cloudStatus = "انتهت جلسة الجهاز", cloudError = "أنشئ رمز ربط جديداً من المنصة. احتُفظ بالمشاريع المخزنة محلياً.") }
            return
        }
        _state.update { it.copy(isRefreshingCloudProjects = true, cloudError = null) }
        viewModelScope.launch(Dispatchers.IO) {
            runCatching { cloudApi.listProjects(connection) }
                .onSuccess { projects ->
                    val updatedConnection = connection.copy(cachedProjects = projects)
                    connectionStore.save(updatedConnection)
                    _state.update { it.copy(cloudProjects = projects, cloudStatus = "آخر تحديث من المنصة ناجح", cloudError = null, isRefreshingCloudProjects = false) }
                }
                .onFailure { error ->
                    _state.update { it.copy(cloudStatus = "تعذر التحديث؛ تُعرض النسخة المحلية", cloudError = error.message ?: "تعذر الوصول إلى المنصة.", isRefreshingCloudProjects = false) }
                }
        }
    }

    fun importCloudProject(projectId: String) {
        val connection = connectionStore.load()
        if (connection == null || connection.isExpired()) {
            _state.update { it.copy(cloudError = "اربط الجهاز برمز جديد قبل تنزيل المشروع السحابي.") }
            return
        }
        if (_state.value.cloudProjects.none { it.id == projectId }) {
            _state.update { it.copy(cloudError = "المشروع المطلوب غير موجود ضمن قائمة الحساب المملوك.") }
            return
        }
        _state.update { it.copy(isRefreshingCloudProjects = true, cloudError = null, cloudStatus = "جارٍ تنزيل المشروع السحابي") }
        viewModelScope.launch(Dispatchers.IO) {
            runCatching { NativeCloudProjectImporter.import(cloudApi.downloadProjectFile(connection, projectId)) }
                .onSuccess { imported ->
                    _state.update { state ->
                        state.copy(
                            project = imported.project,
                            measurements = imported.measurements,
                            calibration = imported.calibration,
                            layers = listOf(NativeLayer(1L, "قياسات مستوردة", TAKEOFF_LAYER_COLORS[0])),
                            selectedLayerId = 1L,
                            selectedTemplateId = null,
                            selectedMeasurementIds = emptySet(),
                            cutoutTargetId = null,
                            annotations = emptyList(),
                            activePageId = imported.activePageId,
                            cloudStatus = "استُورد ${imported.measurements.size} عنصر قياس إلى النسخة المحلية",
                            cloudError = null,
                            isRefreshingCloudProjects = false
                        )
                    }
                    nextMeasurementId = (imported.measurements.maxOfOrNull { it.id } ?: 0L) + 1L
                    nextPageId = (imported.project.pages.maxOfOrNull { it.id } ?: 0L) + 1L
                    persistWorkspace()
                }
                .onFailure { error ->
                    _state.update { it.copy(cloudStatus = "تعذر الاستيراد؛ بقيت مساحة العمل المحلية كما هي", cloudError = error.message ?: "تعذر تنزيل ملف المشروع.", isRefreshingCloudProjects = false) }
                }
        }
    }

    fun loadCloudDocuments(projectId: String) {
        val connection = connectionStore.load()
        if (connection == null || connection.isExpired()) {
            _state.update { it.copy(cloudError = "اربط الجهاز برمز جديد قبل عرض وثائق PDF.") }
            return
        }
        _state.update { it.copy(isRefreshingCloudProjects = true, cloudError = null, cloudStatus = "جارٍ تحميل وثائق PDF") }
        viewModelScope.launch(Dispatchers.IO) {
            runCatching { cloudApi.listDocuments(connection, projectId) }
                .onSuccess { documents -> _state.update { it.copy(cloudDocuments = documents, cloudDocumentProjectId = projectId, cloudStatus = "تتوفر ${documents.size} وثيقة PDF مملوكة", cloudError = null, isRefreshingCloudProjects = false) } }
                .onFailure { error -> _state.update { it.copy(cloudStatus = "تعذر عرض الوثائق؛ بقيت النسخة المحلية كما هي", cloudError = error.message ?: "تعذر تحميل الوثائق.", isRefreshingCloudProjects = false) } }
        }
    }

    fun loadCloudReviews(projectId: String) {
        val connection = connectionStore.load()
        if (connection == null || connection.isExpired()) {
            _state.update { it.copy(cloudError = "اربط الجهاز برمز جديد قبل عرض المراجعات.") }
            return
        }
        _state.update { it.copy(isRefreshingCloudProjects = true, cloudError = null, cloudStatus = "جارٍ تحميل مراجعات المخطط") }
        viewModelScope.launch(Dispatchers.IO) {
            runCatching { cloudApi.listReviews(connection, projectId) }
                .onSuccess { reviews -> _state.update { it.copy(cloudReviews = reviews, cloudReviewProjectId = projectId, cloudStatus = "تتوفر ${reviews.size} مراجعة مملوكة", cloudError = null, isRefreshingCloudProjects = false) } }
                .onFailure { error -> _state.update { it.copy(cloudStatus = "تعذر عرض المراجعات؛ بقيت النسخة المحلية كما هي", cloudError = error.message ?: "تعذر تحميل المراجعات.", isRefreshingCloudProjects = false) } }
        }
    }

    fun openCloudReview(projectId: String, review: NativeCloudReview) {
        val connection = connectionStore.load()
        if (connection == null || connection.isExpired()) {
            _state.update { it.copy(cloudError = "اربط الجهاز برمز جديد قبل فتح المراجعة.") }
            return
        }
        _state.update { it.copy(isDownloadingCloudPdf = true, cloudError = null, cloudStatus = "جارٍ تنزيل طبقة المراجعة ${review.label}") }
        viewModelScope.launch(Dispatchers.IO) {
            val safeName = review.referenceDocumentName.replace(Regex("[^A-Za-z0-9._-]"), "_").take(120).ifBlank { "reference.pdf" }
            val destination = File(getApplication<Application>().filesDir, "cloud-pdf/review-${review.id}-$safeName")
            runCatching {
                val file = cloudApi.downloadPdf(connection, projectId, review.referenceDocumentId, destination)
                renderPdfPage(getApplication(), Uri.fromFile(file))
            }.onSuccess { bitmap ->
                _state.update { it.copy(referencePdfBitmap = bitmap, referencePdfLabel = review.label, isReferenceOverlayVisible = true, cloudStatus = "تُعرض طبقة المراجعة ${review.label} فوق المخطط", cloudError = null, isDownloadingCloudPdf = false) }
            }.onFailure { error ->
                _state.update { it.copy(cloudStatus = "تعذر فتح طبقة المراجعة؛ بقيت مساحة العمل كما هي", cloudError = error.message ?: "تعذر تحميل المراجعة.", isDownloadingCloudPdf = false) }
            }
        }
    }

    fun toggleReferenceOverlay() {
        if (_state.value.referencePdfBitmap == null) return
        _state.update { it.copy(isReferenceOverlayVisible = !it.isReferenceOverlayVisible) }
    }

    fun downloadCloudPdf(projectId: String, document: NativeCloudDocument) {
        val connection = connectionStore.load()
        if (connection == null || connection.isExpired()) {
            _state.update { it.copy(cloudError = "اربط الجهاز برمز جديد قبل تنزيل PDF.") }
            return
        }
        _state.update { it.copy(isDownloadingCloudPdf = true, cloudError = null, cloudStatus = "جارٍ تنزيل ${document.originalName}") }
        viewModelScope.launch(Dispatchers.IO) {
            val safeName = document.originalName.replace(Regex("[^A-Za-z0-9._-]"), "_").take(120).ifBlank { "drawing.pdf" }
            val destination = File(getApplication<Application>().filesDir, "cloud-pdf/${document.id}-$safeName")
            runCatching { cloudApi.downloadPdf(connection, projectId, document.id, destination) }
                .onSuccess { file ->
                    _state.update { it.copy(cloudStatus = "حُفظ PDF محلياً ويجري فتحه", cloudError = null, isDownloadingCloudPdf = false) }
                    openPdf(getApplication(), Uri.fromFile(file), document.originalName)
                }
                .onFailure { error -> _state.update { it.copy(cloudStatus = "تعذر تنزيل PDF؛ بقيت النسخة المحلية كما هي", cloudError = error.message ?: "تعذر تنزيل PDF.", isDownloadingCloudPdf = false) } }
        }
    }

    fun clearCloudConnection() {
        connectionStore.clear()
        _state.update { it.copy(cloudProjects = emptyList(), cloudStatus = "أُلغي ربط الجهاز", cloudError = null) }
    }

    fun createProjectVersion(label: String) {
        val version = runCatching { NativeVersionHistory.create(nextVersionId++, label, workspaceFromState(), System.currentTimeMillis()) }.getOrElse { error ->
            _state.update { it.copy(inputSource = error.message ?: "تعذر إنشاء الإصدار") }
            return
        }
        _state.update { it.copy(versions = (it.versions + version).takeLast(20), inputSource = "حُفظ إصدار محلي: ${version.label}") }
        persistVersions()
    }

    fun compareProjectVersion(versionId: Long) {
        val target = _state.value.versions.firstOrNull { it.id == versionId } ?: return
        _state.update { it.copy(versionComparison = NativeVersionHistory.compare(workspaceFromState(), target), inputSource = "عُرضت فروق الإصدار ${target.label}") }
    }

    fun restoreProjectVersion(versionId: Long) {
        val target = _state.value.versions.firstOrNull { it.id == versionId } ?: return
        val plan = NativeVersionHistory.prepareRestore(workspaceFromState(), target, nextVersionId++, System.currentTimeMillis())
        _state.update { state ->
            val workspace = plan.restoredWorkspace
            state.copy(
                project = workspace.project,
                measurements = workspace.measurements,
                calibration = workspace.calibration,
                layers = workspace.layers,
                selectedLayerId = workspace.selectedLayerId,
                templates = workspace.templates,
                selectedTemplateId = workspace.selectedTemplateId,
                annotations = workspace.annotations,
                selectedMeasurementIds = emptySet(),
                cutoutTargetId = null,
                activePageId = workspace.project.pages.lastOrNull()?.id,
                versions = (state.versions + plan.backup).takeLast(20),
                versionComparison = null,
                inputSource = "استُعيد الإصدار ${target.label} مع حفظ نسخة احتياطية تلقائية"
            )
        }
        nextMeasurementId = (_state.value.measurements.maxOfOrNull { it.id } ?: 0L) + 1L
        nextPageId = (_state.value.project.pages.maxOfOrNull { it.id } ?: 0L) + 1L
        persistWorkspace()
        persistVersions()
    }

    fun selectCutoutTarget(id: Long) {
        _state.update { state ->
            val eligible = state.measurements.any { it.id == id && it.kind in setOf(MeasurementKind.AREA, MeasurementKind.ROOF_AREA) }
            if (eligible) state.copy(cutoutTargetId = id, inputSource = "اختيرت مساحة هدف للفتحات") else state.copy(inputSource = "الفتحات تتطلب مساحة أو سطحاً مائلاً")
        }
    }

    fun addLayer(name: String) {
        val normalized = name.trim().take(80)
        if (normalized.isEmpty()) return
        val layer = NativeLayer(nextLayerId++, normalized, TAKEOFF_LAYER_COLORS[(nextLayerId % TAKEOFF_LAYER_COLORS.size).toInt()])
        _state.update { it.copy(layers = it.layers + layer, selectedLayerId = layer.id, inputSource = "اختيرت طبقة $normalized") }
        persistWorkspace()
    }

    fun selectLayer(layerId: Long) {
        _state.update { state -> if (state.layers.any { it.id == layerId }) state.copy(selectedLayerId = layerId) else state }
    }

    fun toggleLayer(layerId: Long) {
        _state.update { state -> state.copy(layers = state.layers.map { if (it.id == layerId) it.copy(visible = !it.visible) else it }) }
        persistWorkspace()
    }

    fun addTemplate(name: String, unit: String, rateText: String, kind: TemplateKind) {
        val normalizedName = name.trim().take(120)
        val normalizedUnit = unit.trim().take(32)
        val rate = rateText.toDoubleOrNull()
        if (normalizedName.isEmpty() || normalizedUnit.isEmpty() || rate == null || !rate.isFinite() || rate < 0) return
        val template = NativeTemplate(nextTemplateId++, kind, normalizedName, normalizedUnit, rate)
        _state.update { it.copy(templates = it.templates + template, selectedTemplateId = template.id, inputSource = "اختير قالب $normalizedName") }
        persistWorkspace()
    }

    fun selectTemplate(templateId: Long?) {
        _state.update { state -> state.copy(selectedTemplateId = templateId?.takeIf { id -> state.templates.any { it.id == id } }) }
    }

    fun addCostItem(name: String, unit: String, factorText: String, rateText: String, wasteText: String, kind: CostKind) {
        val templateId = _state.value.selectedTemplateId ?: return
        val normalizedName = name.trim().take(120)
        val normalizedUnit = unit.trim().take(32)
        val factor = factorText.toDoubleOrNull()
        val rate = rateText.toDoubleOrNull()
        val waste = wasteText.toDoubleOrNull()
        if (normalizedName.isEmpty() || normalizedUnit.isEmpty() || factor == null || rate == null || waste == null || !factor.isFinite() || !rate.isFinite() || !waste.isFinite() || factor < 0 || rate < 0 || waste < 0 || waste > 100) return
        val item = TemplateCostItem(nextCostItemId++, kind, normalizedName, factor, normalizedUnit, rate, waste)
        _state.update { current -> current.copy(templates = current.templates.map { template -> if (template.id == templateId) template.copy(costItems = template.costItems + item) else template }, inputSource = "أضيف بند ${item.name} للقالب") }
        persistWorkspace()
    }

    fun exportReportCsv(): String {
        val current = _state.value
        return NativeReportEngine.toCsv(NativeReportEngine.rows(current.measurements, current.layers, current.templates, current.calibration))
    }

    fun applyCalibration() {
        val current = _state.value
        val knownDistance = current.knownDistance.toDoubleOrNull()
        val drawingDistance = MeasurementEngine.polylineLength(current.calibrationPoints)
        val factor = knownDistance?.let { MeasurementEngine.scaleFactor(drawingDistance, it) }
        if (factor == null) {
            _state.update { it.copy(inputSource = "أدخل مسافة حقيقية موجبة بعد تحديد نقطتين") }
            return
        }
        _state.update {
            it.copy(
                calibration = NativeCalibration(factor, it.scaleUnit),
                inputSource = "اعتمد المقياس: ${"%.5f".format(factor)} ${it.scaleUnit}/وحدة رسم",
                calibrationPoints = emptyList()
            )
        }
        persistWorkspace()
    }

    fun openPdf(context: Context, uri: Uri, label: String) {
        _state.update { it.copy(isLoadingPlan = true, loadError = null, pdfLabel = label) }
        viewModelScope.launch(Dispatchers.IO) {
            val result = runCatching { renderPdfPage(context, uri) }
            withContext(Dispatchers.Main) {
                result.onSuccess { bitmap -> _state.update { current ->
                    val page = current.project.pages.firstOrNull { it.sourceUri == uri.toString() }
                        ?: NativeProjectPage(nextPageId++, label, uri.toString())
                    current.copy(
                        pdfBitmap = bitmap,
                        isLoadingPlan = false,
                        activePageId = page.id,
                        project = if (current.project.pages.any { it.id == page.id }) current.project else current.project.copy(pages = current.project.pages + page)
                    )
                }.also { persistWorkspace() } }
                    .onFailure { error -> _state.update { it.copy(isLoadingPlan = false, loadError = error.message ?: "تعذر عرض المخطط.") } }
            }
        }
    }

    fun selectPage(context: Context, pageId: Long) {
        val page = _state.value.project.pages.firstOrNull { it.id == pageId } ?: return
        val sourceUri = page.sourceUri ?: return
        openPdf(context, Uri.parse(sourceUri), page.name)
    }

    private fun renderPdfPage(context: Context, uri: Uri): Bitmap {
        val descriptor = if (uri.scheme == "file") {
            ParcelFileDescriptor.open(File(uri.path ?: error("مسار PDF غير صالح.")), ParcelFileDescriptor.MODE_READ_ONLY)
        } else {
            context.contentResolver.openFileDescriptor(uri, "r") ?: error("تعذر قراءة ملف PDF المحدد.")
        }
        return descriptor.use {
            PdfRenderer(it).use { renderer ->
                require(renderer.pageCount > 0) { "لا يحتوي ملف PDF على صفحات." }
                renderer.openPage(0).use { page ->
                    Bitmap.createBitmap(page.width * 2, page.height * 2, Bitmap.Config.ARGB_8888).also { bitmap ->
                        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    }
                }
            }
        }
    }

    fun onMotionEvent(event: MotionEvent, planPoint: PlanPoint, screenPoint: Offset) {
        val action = event.actionMasked
        val index = event.actionIndex
        val pointerId = event.getPointerId(index)
        val isStylus = event.getToolType(index) == MotionEvent.TOOL_TYPE_STYLUS
        val source = if (isStylus) "قلم S Pen / Stylus" else "لمس"

        when (action) {
            MotionEvent.ACTION_DOWN -> {
                isPinching = false
                activePointerId = pointerId
                lastScreenPoint = screenPoint
                _state.update { current ->
                    when (current.selectedTool) {
                        NativeTool.PAN -> current.copy(inputSource = source)
                        NativeTool.CALIBRATE -> current.copy(inputSource = "المعايرة: المس النقطة الأولى ثم الثانية")
                        NativeTool.COUNT -> current.copy(inputSource = source)
                        NativeTool.SEGMENT, NativeTool.LINEAR, NativeTool.AREA, NativeTool.ROOF_AREA, NativeTool.VOLUME, NativeTool.CUTOUT -> current.copy(inputSource = source, activePoints = listOf(planPoint))
                        NativeTool.NOTE -> current.copy(inputSource = source)
                    }
                }
            }
            MotionEvent.ACTION_POINTER_DOWN -> {
                if (event.pointerCount >= 2) {
                    isPinching = true
                    activePointerId = null
                    lastPinchDistance = event.pointerDistance()
                    _state.update { it.copy(activePoints = emptyList(), inputSource = "لمس متعدد: تكبير وتحريك") }
                }
            }
            MotionEvent.ACTION_MOVE -> {
                val current = _state.value
                if (isPinching && event.pointerCount >= 2) {
                    val distance = event.pointerDistance()
                    val previousDistance = lastPinchDistance ?: distance
                    val zoom = (current.zoom * (distance / previousDistance)).coerceIn(0.5f, 5f)
                    _state.update { it.copy(zoom = zoom, inputSource = "لمس متعدد: تكبير ${"%.2f".format(zoom)}×") }
                    lastPinchDistance = distance
                } else if (current.selectedTool == NativeTool.PAN) {
                    val previous = lastScreenPoint ?: screenPoint
                    _state.update { it.copy(pan = it.pan + (screenPoint - previous), inputSource = source) }
                    lastScreenPoint = screenPoint
                } else if (activePointerId == pointerId && current.selectedTool != NativeTool.COUNT && current.selectedTool != NativeTool.CALIBRATE && current.selectedTool != NativeTool.SEGMENT) {
                    _state.update { it.copy(activePoints = it.activePoints.appendDistinct(planPoint)) }
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> {
                if (isPinching) {
                    lastPinchDistance = null
                    activePointerId = null
                    lastScreenPoint = null
                    if (action == MotionEvent.ACTION_UP || event.pointerCount <= 2) isPinching = false
                    _state.update { it.copy(activePoints = emptyList()) }
                    return
                }
                val current = _state.value
                when (current.selectedTool) {
                    NativeTool.PAN -> Unit
                    NativeTool.CALIBRATE -> {
                        val points = (current.calibrationPoints + planPoint).takeLast(2)
                        _state.update {
                            it.copy(
                                calibrationPoints = points,
                                inputSource = if (points.size == 2) "أدخل المسافة الحقيقية ثم اعتمد المقياس" else "المعايرة: حُفظت النقطة الأولى"
                            )
                        }
                    }
                    NativeTool.COUNT -> commit(MeasurementKind.COUNT, listOf(planPoint), 1.0)
                    NativeTool.SEGMENT -> {
                        val points = current.activePoints.take(1) + planPoint
                        if (points.size == 2) commit(MeasurementKind.LINEAR, points, MeasurementEngine.polylineLength(points))
                    }
                    NativeTool.LINEAR -> {
                        val points = current.activePoints.appendDistinct(planPoint)
                        if (points.size >= 2) commit(MeasurementKind.LINEAR, points, MeasurementEngine.polylineLength(points))
                    }
                    NativeTool.AREA -> {
                        val points = current.activePoints.appendDistinct(planPoint)
                        if (points.size >= 3) commit(MeasurementKind.AREA, points, MeasurementEngine.polygonArea(points))
                    }
                    NativeTool.ROOF_AREA -> {
                        val points = current.activePoints.appendDistinct(planPoint)
                        val rise = current.roofRise.toDoubleOrNull()
                        val run = current.roofRun.toDoubleOrNull()
                        if (points.size >= 3 && rise != null && run != null) {
                            commit(MeasurementKind.ROOF_AREA, points, MeasurementEngine.roofArea(MeasurementEngine.polygonArea(points), rise, run))
                        } else {
                            _state.update { it.copy(inputSource = "أدخل rise وrun موجبين قبل قياس السطح المائل") }
                        }
                    }
                    NativeTool.VOLUME -> {
                        val points = current.activePoints.appendDistinct(planPoint)
                        val depth = current.volumeDepth.toDoubleOrNull()
                        if (points.size >= 3 && depth != null) {
                            commit(MeasurementKind.VOLUME, points, MeasurementEngine.volume(MeasurementEngine.polygonArea(points), depth))
                        } else {
                            _state.update { it.copy(inputSource = "أدخل عمقاً موجباً قبل قياس الحجم") }
                        }
                    }
                    NativeTool.CUTOUT -> {
                        val targetId = current.cutoutTargetId
                        val points = current.activePoints.appendDistinct(planPoint)
                        if (targetId == null) {
                            _state.update { it.copy(inputSource = "اختر مساحة هدف للفتحات من المفتش أولاً") }
                        } else if (points.size < 3) {
                            _state.update { it.copy(inputSource = "ارسم ثلاث نقاط على الأقل لإنشاء فتحة") }
                        } else {
                            commitCutout(targetId, points)
                        }
                    }
                    NativeTool.NOTE -> {
                        val text = current.noteText.trim()
                        if (text.isEmpty()) _state.update { it.copy(inputSource = "اكتب نص الملاحظة أولاً") }
                        else _state.update { it.copy(annotations = it.annotations + NativeAnnotation(nextAnnotationId++, text, planPoint), inputSource = "أضيفت ملاحظة هندسية") }.also { persistWorkspace() }
                    }
                }
                activePointerId = null
                lastScreenPoint = null
                _state.update { it.copy(activePoints = emptyList()) }
            }
            MotionEvent.ACTION_CANCEL -> {
                activePointerId = null
                lastScreenPoint = null
                lastPinchDistance = null
                isPinching = false
                _state.update { it.copy(activePoints = emptyList(), inputSource = "أُلغي الإدخال لحماية القياس") }
            }
        }
    }

    private fun commitCutout(targetId: Long, rawPoints: List<PlanPoint>) {
        val current = _state.value
        val target = current.measurements.firstOrNull { it.id == targetId }
        if (target == null || target.kind !in setOf(MeasurementKind.AREA, MeasurementKind.ROOF_AREA)) {
            _state.update { it.copy(cutoutTargetId = null, inputSource = "تعذر العثور على مساحة هدف صالحة للفتحة") }
            return
        }
        val points = if (rawPoints.size > 3 && rawPoints.first().isNear(rawPoints.last())) rawPoints.dropLast(1) else rawPoints
        if (!MeasurementEngine.canAddCutout(target.points, target.cutouts, points)) {
            _state.update { it.copy(inputSource = "الفتحة يجب أن تكون حلقة بسيطة داخل الهدف وألا تتقاطع مع فتحة أخرى") }
            return
        }
        val cutouts = target.cutouts + listOf(points)
        val netFlatArea = runCatching { MeasurementEngine.areaWithCutouts(target.points, cutouts) }.getOrElse {
            _state.update { state -> state.copy(inputSource = it.message ?: "تعذر حساب مساحة الفتحة") }
            return
        }
        val netValue = when (target.kind) {
            MeasurementKind.AREA -> netFlatArea
            MeasurementKind.ROOF_AREA -> MeasurementEngine.adjustAreaValueProportionally(
                originalOuterArea = MeasurementEngine.polygonArea(target.points),
                originalMeasuredValue = target.value,
                adjustedFlatArea = netFlatArea
            )
            else -> return
        }
        val updated = target.copy(cutouts = cutouts, value = netValue)
        _state.update { state ->
            state.copy(
                measurements = state.measurements.map { if (it.id == target.id) updated else it },
                inputSource = "أضيفت فتحة ${cutouts.size} وأعيد حساب المساحة الصافية"
            )
        }
        persistWorkspace()
    }

    private fun commit(kind: MeasurementKind, points: List<PlanPoint>, value: Double) {
        val current = _state.value
        val multiplier = current.multiplierInput.toDoubleOrNull()
        if (multiplier == null || !multiplier.isFinite() || multiplier <= 0) {
            _state.update { it.copy(inputSource = "عامل التكرار يجب أن يكون موجباً") }
            return
        }
        val measurement = NativeMeasurement(nextMeasurementId++, kind, points, value, current.selectedLayerId, current.selectedTemplateId, multiplier)
        _state.update { it.copy(measurements = it.measurements + measurement) }
        persistWorkspace()
    }

    private fun List<PlanPoint>.appendDistinct(point: PlanPoint): List<PlanPoint> {
        val last = lastOrNull() ?: return listOf(point)
        return if (kotlin.math.abs(last.x - point.x) < 1f && kotlin.math.abs(last.y - point.y) < 1f) this else this + point
    }

    private fun PlanPoint.isNear(other: PlanPoint): Boolean = kotlin.math.abs(x - other.x) < 1f && kotlin.math.abs(y - other.y) < 1f

    private fun MotionEvent.pointerDistance(): Float {
        if (pointerCount < 2) return 0f
        return kotlin.math.hypot(getX(0) - getX(1), getY(0) - getY(1))
    }

    private fun persistWorkspace() {
        val current = _state.value
        localStore.save(StoredWorkspace(current.project, current.measurements, current.calibration, current.layers, current.selectedLayerId, current.templates, current.selectedTemplateId, current.annotations))
    }

    private fun persistVersions() { localStore.saveVersions(_state.value.versions) }

    private fun workspaceFromState(): StoredWorkspace {
        val current = _state.value
        return StoredWorkspace(current.project, current.measurements, current.calibration, current.layers, current.selectedLayerId, current.templates, current.selectedTemplateId, current.annotations)
    }
}
