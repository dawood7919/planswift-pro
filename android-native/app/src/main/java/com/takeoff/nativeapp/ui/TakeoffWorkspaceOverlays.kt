package com.takeoff.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.takeoff.nativeapp.MeasurementKind
import com.takeoff.nativeapp.NativeMeasurement
import com.takeoff.nativeapp.NativeProjectPage
import com.takeoff.nativeapp.NativeTool
import com.takeoff.nativeapp.measurement.MeasurementEngine
import com.takeoff.nativeapp.measurement.PlanPoint
import kotlin.math.roundToInt

/**
 * Floating workspace chrome.
 *
 * The plan is the hero, so these surfaces are translucent and sit over the drawing instead of
 * taking columns away from it.
 */

/** Real-world unit label for a measurement kind under the page's calibration unit. */
fun unitLabelFor(kind: MeasurementKind, scaleUnit: String?): String {
    val unit = scaleUnit ?: return ""
    return when (kind) {
        MeasurementKind.COUNT -> "عدد"
        MeasurementKind.LINEAR -> unit
        MeasurementKind.AREA, MeasurementKind.ROOF_AREA -> "$unit²"
        MeasurementKind.VOLUME -> "$unit³"
    }
}

fun formatQuantity(value: Double): String =
    if (value >= 100) value.roundToInt().toString() else String.format("%.2f", value)

/** Minimum points a tool needs before its shape can be committed. */
fun minimumPointsFor(tool: NativeTool): Int = when (tool) {
    NativeTool.COUNT, NativeTool.NOTE -> 1
    NativeTool.LINEAR, NativeTool.SEGMENT, NativeTool.CALIBRATE -> 2
    NativeTool.AREA, NativeTool.ROOF_AREA, NativeTool.VOLUME, NativeTool.CUTOUT -> 3
    NativeTool.PAN -> 0
}

/**
 * Live readout while a shape is being drawn: the quantity, a secondary figure an estimator
 * actually checks (perimeter for areas, segment count for runs), and how many points are down.
 */
@Composable
fun MeasurementHud(
    tool: NativeTool,
    activePoints: List<PlanPoint>,
    scaleFactor: Double?,
    scaleUnit: String?,
    modifier: Modifier = Modifier
) {
    if (tool == NativeTool.PAN || activePoints.isEmpty()) return
    val required = minimumPointsFor(tool)
    val ready = activePoints.size >= required
    val kind = when (tool) {
        NativeTool.COUNT -> MeasurementKind.COUNT
        NativeTool.AREA, NativeTool.CUTOUT -> MeasurementKind.AREA
        NativeTool.ROOF_AREA -> MeasurementKind.ROOF_AREA
        NativeTool.VOLUME -> MeasurementKind.VOLUME
        else -> MeasurementKind.LINEAR
    }
    val accent = takeoffKindColor(kind)

    val rawPrimary = when {
        tool == NativeTool.COUNT -> activePoints.size.toDouble()
        kind == MeasurementKind.LINEAR -> MeasurementEngine.polylineLength(activePoints)
        activePoints.size >= 3 -> MeasurementEngine.polygonArea(activePoints)
        else -> 0.0
    }
    val factor = scaleFactor
    val primary = when {
        tool == NativeTool.COUNT -> rawPrimary
        factor == null -> rawPrimary
        kind == MeasurementKind.LINEAR -> rawPrimary * factor
        else -> rawPrimary * factor * factor
    }
    val secondary = when {
        tool == NativeTool.COUNT -> null
        kind == MeasurementKind.LINEAR -> "${activePoints.size - 1} مقطع"
        activePoints.size >= 3 -> {
            val perimeter = MeasurementEngine.polylineLength(activePoints + activePoints.first())
            "${formatQuantity(if (factor != null) perimeter * factor else perimeter)} ${scaleUnit ?: ""} محيط"
        }
        else -> null
    }

    Surface(
        modifier = modifier,
        color = TakeoffSurface.copy(alpha = 0.94f),
        shape = RoundedCornerShape(12.dp),
        shadowElevation = 10.dp
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(modifier = Modifier.size(9.dp).background(accent, RoundedCornerShape(2.dp)))
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(tool.label, style = MaterialTheme.typography.labelSmall, color = TakeoffTextFaint)
                Text(
                    "${formatQuantity(primary)} ${if (factor == null && tool != NativeTool.COUNT) "" else unitLabelFor(kind, scaleUnit ?: "")}".trim(),
                    style = MaterialTheme.typography.titleLarge,
                    color = accent
                )
                secondary?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = TakeoffTextDim) }
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("${activePoints.size} نقطة", style = MaterialTheme.typography.labelLarge, color = TakeoffText)
                Text(
                    if (ready) "جاهز للاعتماد" else "يلزم $required نقاط",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (ready) TakeoffSuccess else TakeoffWarning
                )
                if (factor == null && tool != NativeTool.COUNT) {
                    Text("بلا مقياس", style = MaterialTheme.typography.labelSmall, color = TakeoffWarning)
                }
            }
        }
    }
}

/** Horizontal sheet picker, so a multi-sheet drawing is navigable from the canvas itself. */
@Composable
fun SheetStrip(
    pages: List<NativeProjectPage>,
    activePageId: Long?,
    onSelectPage: (Long) -> Unit,
    modifier: Modifier = Modifier
) {
    if (pages.size < 2) return
    Row(
        modifier = modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        pages.forEach { page ->
            val active = page.id == activePageId
            Surface(
                color = if (active) TakeoffSurfaceHi else TakeoffSurface.copy(alpha = 0.9f),
                shape = RoundedCornerShape(10.dp),
                shadowElevation = if (active) 6.dp else 0.dp,
                onClick = { onSelectPage(page.id) }
            ) {
                Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                    Text(
                        "ورقة ${page.pageIndex + 1}",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (active) TakeoffAccent else TakeoffTextFaint
                    )
                    Text(
                        page.name,
                        style = MaterialTheme.typography.labelLarge,
                        color = if (active) TakeoffText else TakeoffTextDim,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium
                    )
                }
            }
        }
    }
}

/** Committed shapes as colour-coded chips, so the sheet's contents read at a glance. */
@Composable
fun MeasurementChipBar(
    measurements: List<NativeMeasurement>,
    selectedIds: Set<Long>,
    scaleUnit: String?,
    onSelect: (Long) -> Unit,
    modifier: Modifier = Modifier
) {
    if (measurements.isEmpty()) return
    Row(
        modifier = modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        measurements.takeLast(24).forEach { measurement ->
            val accent = takeoffKindColor(measurement.kind)
            val selected = measurement.id in selectedIds
            Surface(
                color = if (selected) TakeoffSurfaceHi else TakeoffSurface.copy(alpha = 0.92f),
                shape = RoundedCornerShape(999.dp),
                onClick = { onSelect(measurement.id) }
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 11.dp, vertical = 7.dp),
                    horizontalArrangement = Arrangement.spacedBy(7.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(modifier = Modifier.size(8.dp).background(accent, RoundedCornerShape(999.dp)))
                    Text(
                        "${formatQuantity(measurement.value * measurement.multiplier)} ${unitLabelFor(measurement.kind, scaleUnit ?: "")}".trim(),
                        style = MaterialTheme.typography.labelLarge,
                        color = if (selected) TakeoffText else TakeoffTextDim
                    )
                }
            }
        }
    }
}

/** Compact scale state, shown on the canvas because every quantity depends on it. */
@Composable
fun ScaleBadge(scaleFactor: Double?, scaleUnit: String?, modifier: Modifier = Modifier) {
    val calibrated = scaleFactor != null
    Surface(
        modifier = modifier,
        color = TakeoffSurface.copy(alpha = 0.9f),
        shape = RoundedCornerShape(999.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 11.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(7.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(7.dp).background(
                    if (calibrated) TakeoffSuccess else TakeoffWarning,
                    RoundedCornerShape(999.dp)
                )
            )
            Text(
                if (calibrated) "مُعاير · ${scaleUnit ?: ""}" else "المقياس غير مضبوط",
                style = MaterialTheme.typography.labelSmall,
                color = if (calibrated) TakeoffTextDim else TakeoffWarning
            )
        }
    }
}
