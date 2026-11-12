package com.nivvi.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONArray
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Locale

class NivviWidget : GlanceAppWidget() {
  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    val spendPaise = preferences.getString(SPEND_PAISE, "")
    val syncState = preferences.getString(SYNC_STATE, "SIGNED_OUT") ?: "SIGNED_OUT"
    val names = runCatching {
      val json = JSONArray(preferences.getString(CATEGORIES, "[]"))
      (0 until json.length()).mapNotNull { json.optString(it).takeIf(String::isNotBlank) }
    }.getOrDefault(emptyList())
    provideContent {
      WidgetContent(
        spend = spendPaise?.let(::formatRupees) ?: "Open Nivvi to load spending",
        status = when (syncState) {
          "SYNCED" -> "Up to date"
          "DEVICE_ONLY", "OFFLINE" -> "Device only \u00B7 sync pending"
          else -> "Open Nivvi to sign in"
        },
        categoryNames = names,
      )
    }
  }

  @Composable
  private fun WidgetContent(spend: String, status: String, categoryNames: List<String>) {
    val context = LocalContext.current
    Column(
      modifier = GlanceModifier.fillMaxSize()
        .background(ColorProvider(android.graphics.Color.rgb(247, 248, 242)))
        .padding(14.dp),
      verticalAlignment = Alignment.Top,
    ) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        Text("nivvi", style = TextStyle(color = ColorProvider(android.graphics.Color.rgb(39, 82, 63)), fontSize = 16.sp, fontWeight = FontWeight.Bold))
        Spacer(GlanceModifier.width(8.dp))
        Text("THIS MONTH", style = TextStyle(color = ColorProvider(android.graphics.Color.rgb(93, 111, 101)), fontSize = 12.sp, fontWeight = FontWeight.Medium))
      }
      Text(spend, style = TextStyle(color = ColorProvider(android.graphics.Color.rgb(28, 43, 36)), fontSize = 23.sp, fontWeight = FontWeight.Bold))
      Text(status, style = TextStyle(color = ColorProvider(android.graphics.Color.rgb(69, 105, 82)), fontSize = 12.sp))
      Spacer(GlanceModifier.defaultWeight())
      Row(verticalAlignment = Alignment.CenterVertically) {
        listOf("100", "250", "500").forEach { amount ->
          Text(
            text = "+\u20B9$amount",
            modifier = GlanceModifier.padding(end = 6.dp)
              .padding(horizontal = 8.dp, vertical = 6.dp)
              .background(ColorProvider(android.graphics.Color.rgb(221, 240, 165)))
              .clickable(actionStartActivity(widgetIntent(context, amount, categoryNames.firstOrNull()))),
            style = TextStyle(color = ColorProvider(android.graphics.Color.rgb(28, 63, 46)), fontSize = 13.sp, fontWeight = FontWeight.Bold),
          )
        }
      }
      if (categoryNames.isNotEmpty()) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = GlanceModifier.padding(top = 7.dp)) {
          categoryNames.take(3).forEach { name ->
            Text(
              text = name,
              modifier = GlanceModifier.padding(horizontal = 5.dp, vertical = 6.dp)
                .clickable(actionStartActivity(widgetIntent(context, "100", name))),
              style = TextStyle(color = ColorProvider(android.graphics.Color.rgb(52, 83, 68)), fontSize = 12.sp),
            )
          }
        }
      }
    }
  }

  companion object {
    const val PREFERENCES = "com.nivvi.widget.summary"
    const val SPEND_PAISE = "month_spend_paise"
    const val SYNC_STATE = "sync_state"
    const val CATEGORIES = "expense_categories"
  }
}

class NivviWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = NivviWidget()
}

private fun widgetIntent(context: Context, amountRupees: String, categoryName: String?): Intent {
  val scheme = if (context.packageName.endsWith(".dev")) "nivvi-dev" else "nivvi"
  val builder = Uri.Builder().scheme(scheme).authority("transaction")
    .appendQueryParameter("type", "expense")
    .appendQueryParameter("amount", amountRupees)
  if (categoryName != null) builder.appendQueryParameter("categoryName", categoryName)
  return Intent(Intent.ACTION_VIEW, builder.build())
    .setPackage(context.packageName)
    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
}

private fun formatRupees(paise: String): String = runCatching {
  val rupees = BigDecimal(paise).movePointLeft(2)
  NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IN")).format(rupees)
}.getOrDefault("\u20B90")
