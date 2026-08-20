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
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.res.stringResource
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
    Surface(modifier = Modifier.fillMaxSize(), color = com.takeoff.nativeapp.ui.TakeoffPaper) {
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
            } else BoxWithConstraints(modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp, vertical = 12.dp)) {
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
                            color = com.takeoff.nativeapp.ui.TakeoffPaper,
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
                                color = com.takeoff.nativeapp.ui.TakeoffPaper,
                                shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp),
                                shadowElevation = 12.dp
                            ) { inspector() }
                        } else {
                            FloatingActionButton(
                                onClick = { isInspectorOpen = true },
                                modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
                                containerColor = MaterialTheme.colorScheme.primary,
                                contentColor = MaterialTheme.colorScheme.onPrimary
                            ) { Text(stringResource(R.string.panel)) }
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
    Box(modifier = modifier.background(com.takeoff.nativeapp.ui.TakeoffInk).padding(22.dp), contentAlignment = Alignment.Center) {
        Surface(
            color = Color(0xFFF8FAF7),
            shape = RoundedCornerShape(28.dp),
            shadowElevation = 10.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(26.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Surface(color = com.takeoff.nativeapp.ui.TakeoffSignal, shape = RoundedCornerShape(12.dp)) {
                    Text(stringResource(R.string.start_tag), modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp), style = MaterialTheme.typography.labelLarge, color = com.takeoff.nativeapp.ui.TakeoffInk)
                }
                Text(stringResource(R.string.start_title), style = MaterialTheme.typography.headlineSmall, color = com.takeoff.nativeapp.ui.TakeoffInk)
                Text(stringResource(R.string.start_body), style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Surface(color = Color(0xFFEAF0EC), shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                        Text(stringResource(R.string.start_flow), style = MaterialTheme.typography.titleSmall, color = com.takeoff.nativeapp.ui.TakeoffInk)
                        Text(stringResource(R.string.start_step_one), style = MaterialTheme.typography.bodyMedium)
                        Text(stringResource(R.string.start_step_two), style = MaterialTheme.typography.bodyMedium)
                        Text(stringResource(R.string.start_step_three), style = MaterialTheme.typography.bodyMedium)
                    }
                }
                Button(onClick = onOpenPlan, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.open_plan)) }
                OutlinedButton(onClick = onOpenWorkspace, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.open_workspace)) }
                Text(stringResource(R.string.start_local_first), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
        }
    }
}
