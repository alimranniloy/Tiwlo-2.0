package com.example.data

import android.content.Context
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import android.util.Base64
import java.io.IOException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class TiwloApi(context: Context) {
    private val sessionCookieJar = PersistentCookieJar(context.applicationContext)
    private val client = OkHttpClient.Builder()
        .cookieJar(sessionCookieJar)
        .build()

    suspend fun get(path: String): Any? = request(path, "GET")

    suspend fun post(
        path: String,
        body: JSONObject = JSONObject(),
        headers: Map<String, String> = emptyMap()
    ): Any? = request(path, "POST", body, headers)

    suspend fun put(path: String, body: JSONObject): Any? = request(path, "PUT", body)

    suspend fun patch(path: String, body: JSONObject): Any? = request(path, "PATCH", body)

    suspend fun delete(path: String, body: JSONObject? = null): Any? =
        request(path, "DELETE", body)

    fun clearSession() = sessionCookieJar.clear()

    private suspend fun request(
        path: String,
        method: String,
        body: JSONObject? = null,
        headers: Map<String, String> = emptyMap()
    ): Any? =
        withContext(Dispatchers.IO) {
            val url = BASE_URL.resolve("/api/${path.trimStart('/')}")
                ?: throw IOException("Invalid Tiwlo API path.")
            val requestBody = body?.toString()?.toRequestBody(JSON_MEDIA_TYPE)
            val builder = Request.Builder()
                .url(url)
                .header("Accept", "application/json")
                .method(method, if (method == "GET" || method == "HEAD") null else requestBody)
            if (requestBody != null) builder.header("Content-Type", "application/json")
            headers.forEach { (name, value) -> builder.header(name, value) }

            client.newCall(builder.build()).execute().use { response ->
                val responseText = response.body?.string().orEmpty()
                val parsed = responseText.takeIf(String::isNotBlank)?.let(::parseJson)
                if (!response.isSuccessful) {
                    val message = (parsed as? JSONObject)?.optString("error")
                        ?.takeIf(String::isNotBlank)
                        ?: "Tiwlo API request failed (${response.code})."
                    throw TiwloApiException(response.code, message, parsed)
                }
                parsed
            }
        }

    private fun parseJson(value: String): Any? = try {
        JSONTokener(value).nextValue()
    } catch (error: Exception) {
        throw IOException("Tiwlo API returned invalid JSON.", error)
    }

    companion object {
        private val BASE_URL = "https://tiwlo.com/".toHttpUrl()
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}

class TiwloApiException(
    val statusCode: Int,
    message: String,
    val responseBody: Any?
) : IOException(message)

private class PersistentCookieJar(context: Context) : CookieJar {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val lock = Any()

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        synchronized(lock) {
            val current = readCookies()
                .filterNot { old -> cookies.any { it.name == old.name && it.domain == old.domain && it.path == old.path } }
                .filter { it.expiresAt > System.currentTimeMillis() }
            writeCookies(current + cookies.filter { it.expiresAt > System.currentTimeMillis() })
        }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> = synchronized(lock) {
        val now = System.currentTimeMillis()
        val cookies = readCookies()
        val valid = cookies.filter { it.expiresAt > now }
        if (valid.size != cookies.size) writeCookies(valid)
        valid.filter { it.matches(url) }
    }

    fun clear() {
        synchronized(lock) {
            if (!preferences.edit().remove(COOKIES_KEY).commit()) {
                throw IllegalStateException("Could not clear the saved Tiwlo session.")
            }
        }
    }

    private fun readCookies(): List<Cookie> {
        val stored = preferences.getString(COOKIES_KEY, null) ?: return emptyList()
        val payload = try {
            JSONObject(stored)
        } catch (error: Exception) {
            throw IllegalStateException("The saved Tiwlo session is corrupted.", error)
        }
        val json = try {
            val encrypted = Base64.decode(payload.getString("data"), Base64.NO_WRAP)
            val iv = Base64.decode(payload.getString("iv"), Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(128, iv))
            JSONArray(String(cipher.doFinal(encrypted), Charsets.UTF_8))
        } catch (error: Exception) {
            throw IllegalStateException("The saved Tiwlo session could not be decrypted.", error)
        }
        return buildList {
            for (index in 0 until json.length()) {
                val item = json.optJSONObject(index) ?: continue
                val builder = Cookie.Builder()
                    .name(item.getString("name"))
                    .value(item.getString("value"))
                    .path(item.getString("path"))
                    .expiresAt(item.getLong("expiresAt"))
                if (item.optBoolean("hostOnly")) {
                    builder.hostOnlyDomain(item.getString("domain"))
                } else {
                    builder.domain(item.getString("domain"))
                }
                if (item.optBoolean("secure")) builder.secure()
                if (item.optBoolean("httpOnly")) builder.httpOnly()
                try {
                    add(builder.build())
                } catch (_: IllegalArgumentException) {
                    Unit
                }
            }
        }
    }

    private fun writeCookies(cookies: List<Cookie>) {
        val json = JSONArray()
        cookies.forEach { cookie ->
            json.put(
                JSONObject()
                    .put("name", cookie.name)
                    .put("value", cookie.value)
                    .put("domain", cookie.domain)
                    .put("path", cookie.path)
                    .put("expiresAt", cookie.expiresAt)
                    .put("hostOnly", cookie.hostOnly)
                    .put("secure", cookie.secure)
                    .put("httpOnly", cookie.httpOnly)
            )
        }
        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
            val encrypted = cipher.doFinal(json.toString().toByteArray(Charsets.UTF_8))
            val payload = JSONObject()
                .put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
                .put("data", Base64.encodeToString(encrypted, Base64.NO_WRAP))
            if (!preferences.edit().putString(COOKIES_KEY, payload.toString()).commit()) {
                throw IllegalStateException("Could not save the encrypted Tiwlo session.")
            }
        } catch (error: Exception) {
            throw IllegalStateException("Could not encrypt the Tiwlo session.", error)
        }
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    companion object {
        private const val PREFERENCES_NAME = "tiwlo_api_session"
        private const val COOKIES_KEY = "cookies"
        private const val KEY_ALIAS = "tiwlo_api_session_key"
    }
}

fun Any?.asJsonObject(): JSONObject? = this as? JSONObject

fun Any?.asJsonArray(): JSONArray? = this as? JSONArray

fun String.toApiPathSegment(): String = Uri.encode(this)
