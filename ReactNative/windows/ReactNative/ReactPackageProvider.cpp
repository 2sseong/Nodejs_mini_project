#include "pch.h"
#include "ReactPackageProvider.h"
#include "NativeModules.h"

// 👇 이 줄 추가
#include "ChatWindowManager.h"

using namespace winrt::Microsoft::ReactNative;

void ReactPackageProvider::CreatePackage(IReactPackageBuilder const &packageBuilder) noexcept
{
    AddAttributedModules(packageBuilder); // ✅ 반드시 존재해야 함

    // 또는 직접 등록 방식 (AddAttributedModules가 없다면 이걸 대신 추가)
    // packageBuilder.AddModule(L"ChatWindowManager",
    //     winrt::make<winrt::ChatWindowManager::implementation::ChatWindowManager>());
}
