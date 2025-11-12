#pragma once
#include <winrt/Microsoft.ReactNative.h>

struct ReactPackageProvider : winrt::implements<ReactPackageProvider, winrt::Microsoft::ReactNative::IReactPackageProvider>
{
    void CreatePackage(winrt::Microsoft::ReactNative::IReactPackageBuilder const& packageBuilder) noexcept;
};
