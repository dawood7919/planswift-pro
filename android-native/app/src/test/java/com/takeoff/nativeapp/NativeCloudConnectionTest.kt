package com.takeoff.nativeapp

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeCloudConnectionTest {
    @Test
    fun `device connection expires exactly at its bounded expiry time`() {
        val connection = NativeDeviceConnection(
            endpoint = "https://takeoff.example",
            token = "session-token",
            expiresAtEpochMillis = 1_000L
        )

        assertFalse(connection.isExpired(now = 999L))
        assertTrue(connection.isExpired(now = 1_000L))
    }
}
