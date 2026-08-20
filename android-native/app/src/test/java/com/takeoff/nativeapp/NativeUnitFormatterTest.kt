package com.takeoff.nativeapp

import com.takeoff.nativeapp.i18n.NativeUnitFormatter
import com.takeoff.nativeapp.i18n.NativeUnitSystem
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Locale

class NativeUnitFormatterTest {
    @Test fun `converts immutable metric values for imperial display`() {
        assertEquals("3.28 ft", NativeUnitFormatter.length(1.0, "m", NativeUnitSystem.IMPERIAL, Locale.US))
        assertEquals("10.76 SF", NativeUnitFormatter.area(1.0, "m", NativeUnitSystem.IMPERIAL, Locale.US))
        assertEquals("1.31 CY", NativeUnitFormatter.volume(1.0, "m", NativeUnitSystem.IMPERIAL, Locale.US))
        assertEquals("5' 6\"", NativeUnitFormatter.feetInches(5.5))
    }
}
