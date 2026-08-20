package com.takeoff.nativeapp

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.enableEdgeToEdge
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.Button
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.takeoff.nativeapp.ui.TakeoffCanvas
import com.takeoff.nativeapp.ui.TakeoffCommandBar
import com.takeoff.nativeapp.ui.TakeoffInspector
import com.takeoff.nativeapp.ui.TakeoffTheme

class MainActivity : ComponentActivity() {
    private val viewModel: TakeoffViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TakeoffTheme {
                val state by viewModel.state.collectAsState()
                val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
                    uri?.let {
                        contentResolver.takePersistableUriPermission(it, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        viewModel.openPdf(this, it, it.lastPathSegment ?: "مخطط PDF")
                    }
                }
                val reportExporter = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
                    uri?.let { destination ->
                        contentResolver.openOutputStream(destination)?.bufferedWriter()?.use { writer ->
                            writer.write(viewModel.exportReportCsv())
                        }
                    }
                }
                TakeoffNativeScreen(
                    state = state,
                    onOpenPlan = { filePicker.launch(arrayOf("application/pdf")) },
                    onToolSelected = viewModel::selectTool,
                    onClear = viewModel::clearMeasurements,
                    onUndo = viewModel::undoLastMeasurement,
                    onDeleteMeasurement = viewModel::deleteMeasurement,
                    onDuplicateMeasurement = viewModel::duplicateMeasurement,
                    onToggleMeasurementSelection = viewModel::toggleMeasurementSelection,
                    onSelectCutoutTarget = viewModel::selectCutoutTarget,
                    onDeleteSelectedMeasurements = viewModel::deleteSelectedMeasurements,
                    onDuplicateSelectedMeasurements = viewModel::duplicateSelectedMeasurements,
                    onKnownDistanceChange = viewModel::setKnownDistance,
                    onScaleUnitChange = viewModel::setScaleUnit,
                    onRoofRiseChange = viewModel::setRoofRise,
                    onRoofRunChange = viewModel::setRoofRun,
                    onVolumeDepthChange = viewModel::setVolumeDepth,
                    onMultiplierChange = viewModel::setMultiplierInput,
                    onNoteTextChange = viewModel::setNoteText,
                    onCloudEndpointChange = viewModel::setCloudEndpoint,
                    onConnectCloud = viewModel::connectCloud,
                    onRefreshCloudProjects = viewModel::refreshCloudProjects,
                    onImportCloudProject = viewModel::importCloudProject,
                    onLoadCloudDocuments = viewModel::loadCloudDocuments,
                    onLoadCloudReviews = viewModel::loadCloudReviews,
                    onDownloadCloudPdf = viewModel::downloadCloudPdf,
                    onOpenCloudReview = viewModel::openCloudReview,
                    onToggleReferenceOverlay = viewModel::toggleReferenceOverlay,
                    onClearCloudConnection = viewModel::clearCloudConnection,
                    onCreateVersion = viewModel::createProjectVersion,
                    onCompareVersion = viewModel::compareProjectVersion,
                    onRestoreVersion = viewModel::restoreProjectVersion,
                    onApplyCalibration = viewModel::applyCalibration,
                    onAddLayer = viewModel::addLayer,
                    onSelectLayer = viewModel::selectLayer,
                    onToggleLayer = viewModel::toggleLayer,
                    onAddTemplate = viewModel::addTemplate,
                    onSelectTemplate = viewModel::selectTemplate,
                    onAddCostItem = viewModel::addCostItem,
                    onExportReport = { reportExporter.launch("takeoff-report.csv") },
                    onSelectPage = { pageId -> viewModel.selectPage(this, pageId) },
                    onMotionEvent = viewModel::onMotionEvent
                )
            }
        }
    }
}

@Composable
private fun TakeoffNativeScreen(
    state: TakeoffUiState,
    onOpenPlan: () -> Unit,
    onToolSelected: (NativeTool) -> Unit,
    onClear: () -> Unit,
    onUndo: () -> Unit,
    onDeleteMeasurement: (Long) -> Unit,
    onDuplicateMeasurement: (Long) -> Unit,
    onToggleMeasurementSelection: (Long) -> Unit,
    onSelectCutoutTarget: (Long) -> Unit,
    onDeleteSelectedMeasurements: () -> Unit,
    onDuplicateSelectedMeasurements: () -> Unit,
    onKnownDistanceChange: (String) -> Unit,
    onScaleUnitChange: (String) -> Unit,
    onRoofRiseChange: (String) -> Unit,
    onRoofRunChange: (String) -> Unit,
    onVolumeDepthChange: (String) -> Unit,
    onMultiplierChange: (String) -> Unit,
    onNoteTextChange: (String) -> Unit,
    onCloudEndpointChange: (String) -> Unit,
    onConnectCloud: (String, String) -> Unit,
    onRefreshCloudProjects: () -> Unit,
    onImportCloudProject: (String) -> Unit,
    onLoadCloudDocuments: (String) -> Unit,
    onLoadCloudReviews: (String) -> Unit,
    onDownloadCloudPdf: (String, NativeCloudDocument) -> Unit,
    onOpenCloudReview: (String, NativeCloudReview) -> Unit,
    onToggleReferenceOverlay: () -> Unit,
    onClearCloudConnection: () -> Unit,
    onCreateVersion: (String) -> Unit,
    onCompareVersion: (Long) -> Unit,
    onRestoreVersion: (Long) -> Unit,
    onApplyCalibration: () -> Unit,
    onAddLayer: (String) -> Unit,
    onSelectLayer: (Long) -> Unit,
    onToggleLayer: (Long) -> Unit,
    onAddTemplate: (String, String, String, com.takeoff.nativeapp.estimation.TemplateKind) -> Unit,
    onSelectTemplate: (Long?) -> Unit,
    onAddCostItem: (String, String, String, String, String, com.takeoff.nativeapp.estimation.CostKind) -> Unit,
    onExportReport: () -> Unit,
    onSelectPage: (Long) -> Unit,
    onMotionEvent: (android.view.MotionEvent, com.takeoff.nativeapp.measurement.PlanPoint, androidx.compose.ui.geometry.Offset) -> Unit
) {
    var isInspectorOpen by rememberSaveable { mutableStateOf(false) }
    var showWorkspace by rememberSaveable { mutableStateOf(false) }
    Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFFEAF0F3)) {
        Column(modifier = Modifier.fillMaxSize()) {
            TakeoffCommandBar(
                projectName = state.project.name,
                activeTool = state.selectedTool,
                isLoading = state.isLoadingPlan,
                hasMeasurements = state.measurements.isNotEmpty(),
                onOpenPlan = onOpenPlan,
                onToolSelected = onToolSelected,
                onClear = onClear,
                onUndo = onUndo,
                onExportReport = onExportReport,
                onToggleInspector = { showWorkspace = true; isInspectorOpen = !isInspectorOpen }
            )
            if (state.pdfBitmap == null && !state.isLoadingPlan && !showWorkspace) {
                TakeoffStartScreen(
                    onOpenPlan = onOpenPlan,
                    onOpenWorkspace = { showWorkspace = true; isInspectorOpen = true },
                    modifier = Modifier.fillMaxSize()
                )
            } else BoxWithConstraints(modifier = Modifier.fillMaxSize().padding(10.dp)) {
                val inspector = @Composable {
                    TakeoffInspector(
                        state = state,
                        onKnownDistanceChange = onKnownDistanceChange,
                        onScaleUnitChange = onScaleUnitChange,
                        onRoofRiseChange = onRoofRiseChange,
                        onRoofRunChange = onRoofRunChange,
                        onVolumeDepthChange = onVolumeDepthChange,
                        onMultiplierChange = onMultiplierChange,
                        onNoteTextChange = onNoteTextChange,
                        onCloudEndpointChange = onCloudEndpointChange,
                        onConnectCloud = onConnectCloud,
                        onRefreshCloudProjects = onRefreshCloudProjects,
                        onImportCloudProject = onImportCloudProject,
                        onLoadCloudDocuments = onLoadCloudDocuments,
                        onLoadCloudReviews = onLoadCloudReviews,
                        onDownloadCloudPdf = onDownloadCloudPdf,
                        onOpenCloudReview = onOpenCloudReview,
                        onToggleReferenceOverlay = onToggleReferenceOverlay,
                        onClearCloudConnection = onClearCloudConnection,
                        onCreateVersion = onCreateVersion,
                        onCompareVersion = onCompareVersion,
                        onRestoreVersion = onRestoreVersion,
                        onApplyCalibration = onApplyCalibration,
                        onDeleteMeasurement = onDeleteMeasurement,
                        onDuplicateMeasurement = onDuplicateMeasurement,
                        onToggleMeasurementSelection = onToggleMeasurementSelection,
                        onSelectCutoutTarget = onSelectCutoutTarget,
                        onDeleteSelectedMeasurements = onDeleteSelectedMeasurements,
                        onDuplicateSelectedMeasurements = onDuplicateSelectedMeasurements,
                        onAddLayer = onAddLayer,
                        onSelectLayer = onSelectLayer,
                        onToggleLayer = onToggleLayer,
                        onAddTemplate = onAddTemplate,
                        onSelectTemplate = onSelectTemplate,
                        onAddCostItem = onAddCostItem,
                        onSelectPage = onSelectPage,
                        modifier = Modifier.fillMaxSize()
                    )
                }
                val drawing = @Composable {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = Color(0xFF0C2735),
                        shape = RoundedCornerShape(18.dp),
                        shadowElevation = 3.dp
                    ) {
                        TakeoffCanvas(state = state, onOpenPlan = onOpenPlan, onMotionEvent = onMotionEvent)
                    }
                }
                if (maxWidth >= 980.dp) {
                    Row(modifier = Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box(modifier = Modifier.weight(1f).fillMaxSize()) { drawing() }
                        Surface(
                            modifier = Modifier.fillMaxSize().weight(0.38f),
                            color = Color.White,
                            shape = RoundedCornerShape(18.dp),
                            shadowElevation = 2.dp
                        ) { inspector() }
                    }
                } else {
                    Box(modifier = Modifier.fillMaxSize()) {
                        drawing()
                        if (isInspectorOpen) {
                            Surface(
                                modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().heightIn(max = 520.dp),
                                color = Color.White,
                                shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp),
                                shadowElevation = 12.dp
                            ) { inspector() }
                        } else {
                            FloatingActionButton(
                                onClick = { isInspectorOpen = true },
                                modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
                                containerColor = MaterialTheme.colorScheme.primary,
                                contentColor = MaterialTheme.colorScheme.onPrimary
                            ) { Text("لوحة") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TakeoffStartScreen(
    onOpenPlan: () -> Unit,
    onOpenWorkspace: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(modifier = modifier.padding(22.dp), contentAlignment = Alignment.Center) {
        Surface(
            color = Color.White,
            shape = RoundedCornerShape(24.dp),
            shadowElevation = 5.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(28.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("مساحة عمل Takeoff", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
                Text("ابدأ من مخطط PDF، عاير المقياس، ثم سجّل الكميات بطريقة قابلة للمراجعة.", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        Text("01  افتح المخطط", style = MaterialTheme.typography.titleSmall)
                        Text("02  عاير المسافة الحقيقية", style = MaterialTheme.typography.titleSmall)
                        Text("03  اختر أداة القياس وابدأ التقدير", style = MaterialTheme.typography.titleSmall)
                    }
                }
                Button(onClick = onOpenPlan, modifier = Modifier.fillMaxWidth()) { Text("فتح مخطط PDF") }
                Button(onClick = onOpenWorkspace, modifier = Modifier.fillMaxWidth()) { Text("فتح لوحة المشروع والمزامنة") }
                Text("يعمل التطبيق محلياً، ويمكن ربطه بالمنصة من لوحة المشروع عند الحاجة.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
        }
    }
}
