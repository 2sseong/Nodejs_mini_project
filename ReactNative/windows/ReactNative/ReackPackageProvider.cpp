#include "pch.h"
#include "ReactPackageProvider.h"
#include <winrt/Microsoft.ReactNative.h>
#include "ChatWindowManager.h"   // 👈 네이티브 모듈 헤더 포함

using namespace winrt::Microsoft::ReactNative;

void ReactPackageProvider::CreatePackage(IReactPackageBuilder const& packageBuilder) noexcept {
    AddAttributedModules(packageBuilder); // ✅ 모든 REACT_MODULE 등록
}
