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
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
                TakeoffNativeScreen(
                    state = state,
                    onOpenPlan = { filePicker.launch(arrayOf("application/pdf")) },
                    onToolSelected = viewModel::selectTool,
                    onClear = viewModel::clearMeasurements,
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
                onClear = onClear
            )
            Row(modifier = Modifier.fillMaxSize().padding(8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(modifier = Modifier.weight(1f).fillMaxSize().background(Color(0xFF06202D))) {
                    TakeoffCanvas(state = state, onMotionEvent = onMotionEvent)
                }
                TakeoffInspector(state = state, modifier = Modifier.fillMaxSize().weight(0.34f))
            }
        }
    }
}
