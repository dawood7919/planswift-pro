package com.takeoff.nativeapp.estimation

enum class TemplateKind { PART, ASSEMBLY }

enum class CostKind { MATERIAL, LABOR, EQUIPMENT }

data class TemplateCostItem(
    val id: Long,
    val kind: CostKind,
    val name: String,
    val quantityFactor: Double,
    val unit: String,
    val rate: Double,
    val wastePercent: Double = 0.0
)

data class NativeTemplate(
    val id: Long,
    val kind: TemplateKind,
    val name: String,
    val unit: String,
    val rate: Double,
    val costItems: List<TemplateCostItem> = emptyList()
)

data class CostBreakdownEntry(
    val costItemId: Long?,
    val name: String,
    val kind: CostKind?,
    val quantity: Double,
    val unit: String,
    val rate: Double,
    val cost: Double
)

data class EstimateResult(val quantity: Double, val cost: Double, val entries: List<CostBreakdownEntry>)

object EstimationEngine {
    fun estimate(template: NativeTemplate, measurementQuantity: Double, multiplier: Double = 1.0): EstimateResult {
        require(measurementQuantity.isFinite() && measurementQuantity >= 0) { "الكمية يجب أن تكون عدداً موجباً أو صفراً." }
        require(multiplier.isFinite() && multiplier > 0) { "عامل التكرار يجب أن يكون موجباً." }
        require(template.rate.isFinite() && template.rate >= 0) { "سعر القالب غير صالح." }

        val quantity = measurementQuantity * multiplier
        val entries = buildList {
            if (template.rate > 0) add(CostBreakdownEntry(null, template.name, null, quantity, template.unit, template.rate, quantity * template.rate))
            template.costItems.forEach { item ->
                require(item.quantityFactor.isFinite() && item.quantityFactor >= 0) { "عامل كمية ${item.name} غير صالح." }
                require(item.rate.isFinite() && item.rate >= 0) { "سعر ${item.name} غير صالح." }
                require(item.wastePercent.isFinite() && item.wastePercent >= 0) { "هالك ${item.name} غير صالح." }
                val itemQuantity = quantity * item.quantityFactor * (1.0 + item.wastePercent / 100.0)
                add(CostBreakdownEntry(item.id, item.name, item.kind, itemQuantity, item.unit, item.rate, itemQuantity * item.rate))
            }
        }
        return EstimateResult(quantity, entries.sumOf { it.cost }, entries)
    }
}
