package com.example.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.FigtreeFontFamily
import com.example.ui.theme.JetBrainsMonoFontFamily
import com.example.ui.theme.ShadcnBackground
import com.example.ui.theme.ShadcnBorder
import com.example.ui.theme.ShadcnDestructive
import com.example.ui.theme.ShadcnForeground
import com.example.ui.theme.ShadcnInk
import com.example.ui.theme.ShadcnInkForeground
import com.example.ui.theme.ShadcnMuted
import com.example.ui.theme.ShadcnMutedForeground
import com.example.ui.theme.ShadcnPrimary
import com.example.ui.theme.ShadcnPrimaryDark
import com.example.ui.theme.ShadcnPrimaryForeground
import com.example.ui.theme.StatusAmberBg
import com.example.ui.theme.StatusAmberText
import com.example.ui.theme.StatusBlueBg
import com.example.ui.theme.StatusBlueText
import com.example.ui.theme.StatusGreenBg
import com.example.ui.theme.StatusGreenText
import com.example.ui.theme.StatusRedBg
import com.example.ui.theme.StatusRedText
import kotlin.math.roundToInt

enum class StatusTone {
    GREEN, AMBER, RED, BLUE, SLATE
}

enum class SparklineTrend {
    UP, DOWN, NEUTRAL
}

@Composable
fun ShadcnCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        content = content
    )
}

@Composable
fun CardHeader(
    title: String,
    description: String? = null,
    action: (@Composable () -> Unit)? = null
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    fontFamily = FigtreeFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = ShadcnForeground,
                    letterSpacing = (-0.2).sp
                )
                if (!description.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = description,
                        fontFamily = FigtreeFontFamily,
                        fontSize = 12.sp,
                        color = ShadcnMutedForeground
                    )
                }
            }
            if (action != null) {
                Spacer(modifier = Modifier.width(8.dp))
                action()
            }
        }
        HorizontalDivider(color = ShadcnBorder, thickness = 1.dp)
    }
}

@Composable
fun PageHeader(
    title: String,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
    actions: (@Composable ColumnScope.() -> Unit)? = null
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Column {
            Text(
                text = title,
                fontFamily = FigtreeFontFamily,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
                color = ShadcnForeground,
                letterSpacing = (-0.5).sp
            )
            if (!subtitle.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = subtitle,
                    fontFamily = FigtreeFontFamily,
                    fontSize = 13.sp,
                    color = ShadcnMutedForeground,
                    lineHeight = 18.sp
                )
            }
        }
        if (actions != null) {
            Column(content = actions)
        }
    }
}

@Composable
fun StatusPill(
    text: String,
    tone: StatusTone = StatusTone.GREEN,
    showDot: Boolean = false,
    modifier: Modifier = Modifier
) {
    val (bg, fg) = when (tone) {
        StatusTone.GREEN -> StatusGreenBg to StatusGreenText
        StatusTone.AMBER -> StatusAmberBg to StatusAmberText
        StatusTone.RED -> StatusRedBg to StatusRedText
        StatusTone.BLUE -> StatusBlueBg to StatusBlueText
        StatusTone.SLATE -> ShadcnMuted to ShadcnMutedForeground
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(bg)
            .padding(horizontal = 9.dp, vertical = 3.dp)
    ) {
        if (showDot) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(fg)
            )
        }
        Text(
            text = text,
            fontFamily = FigtreeFontFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = 11.sp,
            color = fg
        )
    }
}

@Composable
fun ShadcnPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    trailingIcon: ImageVector? = null
) {
    Row(
        modifier = modifier
            .defaultMinSize(minHeight = 38.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(ShadcnPrimary)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 9.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = ShadcnPrimaryForeground,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
        }
        Text(
            text = text,
            fontFamily = FigtreeFontFamily,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            color = ShadcnPrimaryForeground
        )
        if (trailingIcon != null) {
            Spacer(modifier = Modifier.width(6.dp))
            Icon(
                imageVector = trailingIcon,
                contentDescription = null,
                tint = ShadcnPrimaryForeground,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
fun ShadcnOutlineButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    trailingIcon: ImageVector? = null
) {
    Row(
        modifier = modifier
            .defaultMinSize(minHeight = 36.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(ShadcnBackground)
            .border(1.dp, ShadcnBorder, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = ShadcnForeground,
                modifier = Modifier.size(15.dp)
            )
            Spacer(modifier = Modifier.width(5.dp))
        }
        Text(
            text = text,
            fontFamily = FigtreeFontFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = 12.sp,
            color = ShadcnForeground
        )
        if (trailingIcon != null) {
            Spacer(modifier = Modifier.width(5.dp))
            Icon(
                imageVector = trailingIcon,
                contentDescription = null,
                tint = ShadcnForeground,
                modifier = Modifier.size(15.dp)
            )
        }
    }
}

@Composable
fun ShadcnInput(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
    singleLine: Boolean = true,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardType: KeyboardType = KeyboardType.Text,
    testTag: String? = null
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 40.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(ShadcnBackground)
            .border(1.dp, ShadcnBorder, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 9.dp)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        contentAlignment = if (singleLine) Alignment.CenterStart else Alignment.TopStart
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            if (leadingIcon != null) {
                Icon(
                    imageVector = leadingIcon,
                    contentDescription = null,
                    tint = ShadcnMutedForeground,
                    modifier = Modifier.size(17.dp)
                )
            }
            Box(modifier = Modifier.weight(1f)) {
                if (value.isEmpty()) {
                    Text(
                        text = placeholder,
                        fontFamily = FigtreeFontFamily,
                        fontSize = 13.sp,
                        color = ShadcnMutedForeground
                    )
                }
                BasicTextField(
                    value = value,
                    onValueChange = onValueChange,
                    singleLine = singleLine,
                    visualTransformation = visualTransformation,
                    keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                    textStyle = TextStyle(
                        fontFamily = FigtreeFontFamily,
                        fontSize = 13.sp,
                        color = ShadcnForeground
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
fun StatCard(
    label: String,
    value: String,
    change: String,
    trend: SparklineTrend,
    icon: ImageVector,
    sparkline: List<Float>,
    modifier: Modifier = Modifier
) {
    ShadcnCard(modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = label,
                    fontFamily = FigtreeFontFamily,
                    fontWeight = FontWeight.Medium,
                    fontSize = 12.sp,
                    color = ShadcnMutedForeground,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(ShadcnMuted),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = label,
                        tint = ShadcnForeground,
                        modifier = Modifier.size(15.dp)
                    )
                }
            }

            Text(
                text = value,
                fontFamily = FigtreeFontFamily,
                fontWeight = FontWeight.Bold,
                fontSize = 21.sp,
                color = ShadcnForeground,
                letterSpacing = (-0.5).sp
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val changeColor = when (trend) {
                    SparklineTrend.UP -> ShadcnPrimaryDark
                    SparklineTrend.DOWN -> ShadcnDestructive
                    SparklineTrend.NEUTRAL -> ShadcnMutedForeground
                }
                Text(
                    text = change,
                    fontFamily = FigtreeFontFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 11.sp,
                    color = changeColor,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                if (sparkline.size >= 2) {
                    Canvas(
                        modifier = Modifier
                            .width(46.dp)
                            .height(18.dp)
                    ) {
                        val minV = sparkline.minOrNull() ?: 0f
                        val maxV = (sparkline.maxOrNull() ?: 1f).coerceAtLeast(minV + 0.01f)
                        val stepX = size.width / (sparkline.size - 1).toFloat()
                        val path = Path()
                        sparkline.forEachIndexed { idx, v ->
                            val x = idx * stepX
                            val norm = (v - minV) / (maxV - minV)
                            val y = size.height * (1f - norm)
                            if (idx == 0) path.moveTo(x, y) else path.lineTo(x, y)
                        }
                        drawPath(
                            path = path,
                            color = ShadcnPrimary,
                            style = Stroke(width = 1.8.dp.toPx(), cap = StrokeCap.Round)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun SegmentedPeriodToggle(
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(ShadcnMuted)
            .padding(2.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        options.forEach { opt ->
            val active = opt == selected
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (active) ShadcnInk else Color.Transparent)
                    .clickable { onSelect(opt) }
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = opt,
                    fontFamily = JetBrainsMonoFontFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 10.sp,
                    color = if (active) Color.White else ShadcnMutedForeground
                )
            }
        }
    }
}

@Composable
fun ProgressBarMeter(
    label: String,
    usedLabel: String,
    fraction: Float,
    color: Color = ShadcnPrimary
) {
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = label,
                fontFamily = FigtreeFontFamily,
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp,
                color = ShadcnForeground
            )
            Text(
                text = usedLabel,
                fontFamily = JetBrainsMonoFontFamily,
                fontSize = 11.sp,
                color = ShadcnMutedForeground
            )
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(7.dp)
                .clip(RoundedCornerShape(50))
                .background(ShadcnMuted)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(fraction.coerceIn(0.02f, 1f))
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(50))
                    .background(color)
            )
        }
    }
}

@Composable
fun SmoothAreaLineChart(
    primarySeries: List<Float>,
    secondarySeries: List<Float>,
    xLabels: List<String>,
    primaryColor: Color = ShadcnPrimary,
    secondaryColor: Color = ShadcnInk,
    yMax: Float = 100f,
    ySuffix: String = "",
    height: Dp = 200.dp
) {
    if (primarySeries.isEmpty()) return
    Column(modifier = Modifier.fillMaxWidth()) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(height)
        ) {
            val topPad = 10.dp.toPx()
            val bottomPad = 20.dp.toPx()
            val chartH = (size.height - topPad - bottomPad).coerceAtLeast(10f)
            val stepX = size.width / (primarySeries.size - 1).coerceAtLeast(1).toFloat()

            for (i in 0..3) {
                val y = topPad + (chartH / 3f) * i
                drawLine(
                    color = ShadcnBorder,
                    start = Offset(0f, y),
                    end = Offset(size.width, y),
                    strokeWidth = 1.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 6f), 0f)
                )
            }

            fun buildPaths(series: List<Float>): Pair<Path, Path> {
                val pts = series.mapIndexed { idx, v ->
                    val x = idx * stepX
                    val y = topPad + chartH * (1f - (v / yMax).coerceIn(0f, 1f))
                    Offset(x, y)
                }
                val stroke = Path()
                val fill = Path()
                if (pts.isNotEmpty()) {
                    stroke.moveTo(pts.first().x, pts.first().y)
                    fill.moveTo(pts.first().x, topPad + chartH)
                    fill.lineTo(pts.first().x, pts.first().y)
                    for (i in 0 until pts.lastIndex) {
                        val p0 = pts[i]
                        val p1 = pts[i + 1]
                        val cx = (p0.x + p1.x) / 2f
                        stroke.cubicTo(cx, p0.y, cx, p1.y, p1.x, p1.y)
                        fill.cubicTo(cx, p0.y, cx, p1.y, p1.x, p1.y)
                    }
                    fill.lineTo(pts.last().x, topPad + chartH)
                    fill.close()
                }
                return stroke to fill
            }

            if (secondarySeries.isNotEmpty()) {
                val (secStroke, secFill) = buildPaths(secondarySeries)
                drawPath(
                    path = secFill,
                    brush = Brush.verticalGradient(
                        listOf(secondaryColor.copy(alpha = 0.16f), Color.Transparent)
                    )
                )
                drawPath(
                    path = secStroke,
                    color = secondaryColor,
                    style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round)
                )
            }

            val (priStroke, priFill) = buildPaths(primarySeries)
            drawPath(
                path = priFill,
                brush = Brush.verticalGradient(
                    listOf(primaryColor.copy(alpha = 0.28f), Color.Transparent)
                )
            )
            drawPath(
                path = priStroke,
                color = primaryColor,
                style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round)
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            xLabels.filterIndexed { index, _ -> index % 2 == 0 || xLabels.size <= 7 }.forEach { lbl ->
                Text(
                    text = lbl,
                    fontFamily = JetBrainsMonoFontFamily,
                    fontSize = 10.sp,
                    color = ShadcnMutedForeground
                )
            }
        }
    }
}

@Composable
fun GroupedBarChart(
    labels: List<String>,
    seriesA: List<Float>,
    seriesB: List<Float>,
    colorA: Color = ShadcnPrimary,
    colorB: Color = ShadcnInk,
    yMax: Float = 300f,
    height: Dp = 180.dp
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(height)
        ) {
            val topPad = 8.dp.toPx()
            val bottomPad = 18.dp.toPx()
            val chartH = (size.height - topPad - bottomPad).coerceAtLeast(10f)
            val groupW = size.width / labels.size.coerceAtLeast(1).toFloat()
            val barW = (groupW * 0.26f).coerceAtMost(14.dp.toPx())
            val gap = 4.dp.toPx()

            labels.indices.forEach { idx ->
                val cx = idx * groupW + groupW / 2f
                val hA = ((seriesA.getOrElse(idx) { 0f } / yMax).coerceIn(0f, 1f)) * chartH
                val hB = ((seriesB.getOrElse(idx) { 0f } / yMax).coerceIn(0f, 1f)) * chartH

                drawRoundRect(
                    color = colorA,
                    topLeft = Offset(cx - barW - gap / 2f, topPad + chartH - hA),
                    size = Size(barW, hA),
                    cornerRadius = CornerRadius(4.dp.toPx(), 4.dp.toPx())
                )
                drawRoundRect(
                    color = colorB,
                    topLeft = Offset(cx + gap / 2f, topPad + chartH - hB),
                    size = Size(barW, hB),
                    cornerRadius = CornerRadius(4.dp.toPx(), 4.dp.toPx())
                )
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceAround
        ) {
            labels.forEach { lbl ->
                Text(
                    text = lbl,
                    fontFamily = JetBrainsMonoFontFamily,
                    fontSize = 10.sp,
                    color = ShadcnMutedForeground
                )
            }
        }
    }
}

data class DonutSegment(
    val label: String,
    val value: Float,
    val color: Color
)

@Composable
fun DonutRingChart(
    segments: List<DonutSegment>,
    centerValue: String,
    centerLabel: String,
    size: Dp = 130.dp
) {
    val total = segments.sumOf { it.value.toDouble() }.toFloat().coerceAtLeast(1f)
    Box(
        modifier = Modifier.size(size),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize().padding(8.dp)) {
            var startAngle = -90f
            segments.forEach { seg ->
                val sweep = (seg.value / total) * 360f
                drawArc(
                    color = seg.color,
                    startAngle = startAngle,
                    sweepAngle = sweep - 3f,
                    useCenter = false,
                    style = Stroke(width = 14.dp.toPx(), cap = StrokeCap.Round)
                )
                startAngle += sweep
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = centerValue,
                fontFamily = FigtreeFontFamily,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = ShadcnForeground
            )
            Text(
                text = centerLabel,
                fontFamily = FigtreeFontFamily,
                fontSize = 11.sp,
                color = ShadcnMutedForeground
            )
        }
    }
}

@Composable
fun ToastBanner(
    message: String,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .padding(horizontal = 16.dp)
            .fillMaxWidth()
            .border(1.dp, ShadcnPrimary.copy(alpha = 0.6f), RoundedCornerShape(14.dp)),
        shape = RoundedCornerShape(14.dp),
        color = ShadcnInk,
        shadowElevation = 10.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = Icons.Outlined.CheckCircle,
                    contentDescription = null,
                    tint = ShadcnPrimary,
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    text = message,
                    fontFamily = FigtreeFontFamily,
                    fontWeight = FontWeight.Medium,
                    fontSize = 13.sp,
                    color = Color.White
                )
            }
            Icon(
                imageVector = Icons.Outlined.Close,
                contentDescription = "Dismiss",
                tint = Color.White.copy(alpha = 0.7f),
                modifier = Modifier
                    .size(18.dp)
                    .clickable(onClick = onDismiss)
            )
        }
    }
}
