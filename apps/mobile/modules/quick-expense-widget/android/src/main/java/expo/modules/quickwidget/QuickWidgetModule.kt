package expo.modules.quickwidget

import androidx.glance.appwidget.GlanceAppWidgetManager
import com.nivvi.widget.NivviWidget
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Coroutine
import org.json.JSONArray

class QuickWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NivviQuickWidget")

    AsyncFunction("updateSummary") Coroutine { spendPaise: String, syncState: String, categoriesJson: String ->
      val context = requireNotNull(appContext.reactContext)
      val validSpend = spendPaise.toBigIntegerOrNull()?.takeIf { it.signum() >= 0 }?.toString() ?: "0"
      val categories = runCatching { JSONArray(categoriesJson) }.getOrDefault(JSONArray())
      val safeCategories = JSONArray()
      for (index in 0 until minOf(categories.length(), 4)) {
        val item = categories.optJSONObject(index) ?: continue
        val name = item.optString("name").trim().take(24)
        if (name.isNotEmpty()) safeCategories.put(name)
      }
      context.getSharedPreferences(NivviWidget.PREFERENCES, android.content.Context.MODE_PRIVATE)
        .edit()
        .putString(NivviWidget.SPEND_PAISE, validSpend)
        .putString(NivviWidget.SYNC_STATE, syncState.take(24))
        .putString(NivviWidget.CATEGORIES, safeCategories.toString())
        .apply()

      val widget = NivviWidget()
      GlanceAppWidgetManager(context).getGlanceIds(NivviWidget::class.java).forEach { id ->
        widget.update(context, id)
      }
    }
  }
}
