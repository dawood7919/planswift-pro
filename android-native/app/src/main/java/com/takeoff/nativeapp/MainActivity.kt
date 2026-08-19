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
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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
                    onClearCloudConnection = viewModel::clearCloudConnection,
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
    onClearCloudConnection: () -> Unit,
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
    Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFFF3F7F9)) {
        Column(modifier = Modifier.fillMaxSize()) {
            TakeoffCommandBar(
                activeTool = state.selectedTool,
                isLoading = state.isLoadingPlan,
                hasMeasurements = state.measurements.isNotEmpty(),
                onOpenPlan = onOpenPlan,
                onToolSelected = onToolSelected,
                onClear = onClear,
                onUndo = onUndo,
                onExportReport = onExportReport
            )
            BoxWithConstraints(modifier = Modifier.fillMaxSize().padding(8.dp)) {
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
                        onClearCloudConnection = onClearCloudConnection,
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
                if (maxWidth < 720.dp) {
                    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(modifier = Modifier.weight(1f).fillMaxWidth().background(Color(0xFF06202D))) {
                            TakeoffCanvas(state = state, onMotionEvent = onMotionEvent)
                        }
                        Box(modifier = Modifier.fillMaxWidth().height(230.dp)) { inspector() }
                    }
                } else {
                    Row(modifier = Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(modifier = Modifier.weight(1f).fillMaxSize().background(Color(0xFF06202D))) {
                            TakeoffCanvas(state = state, onMotionEvent = onMotionEvent)
                        }
                        Box(modifier = Modifier.fillMaxSize().weight(0.34f)) { inspector() }
                    }
                }
            }
        }
    }
}
