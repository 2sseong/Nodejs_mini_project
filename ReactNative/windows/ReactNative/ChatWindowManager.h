#pragma once
#include "pch.h"
#include <vector>
#include <winrt/Microsoft.ReactNative.h>
#include <winrt/Microsoft.UI.Xaml.h>

namespace winrt::ChatWindowManager::implementation {

  // JS에서 NativeModules.ChatWindowManager 로 보이게 하는 이름
  REACT_MODULE(ChatWindowManager, L"ChatWindowManager")

  struct ChatWindowManager {
    ChatWindowManager() = default;

    REACT_INIT(Initialize)
    void Initialize(winrt::Microsoft::ReactNative::ReactContext const& ctx) noexcept { m_context = ctx; }

    // JS에서 await ChatWindowManager.open(roomId, title)
    REACT_METHOD(open)
    void open(std::string roomId,
              std::optional<std::string> title,
              winrt::Microsoft::ReactNative::ReactPromise<bool> result) noexcept;

  private:
    winrt::Microsoft::ReactNative::ReactContext m_context{ nullptr };
    std::vector<winrt::Microsoft::UI::Xaml::Window> m_windows; // 창 생존 유지
  };
}

namespace winrt::ChatWindowManager::factory_implementation {
  struct ChatWindowManager : ChatWindowManagerT<ChatWindowManager, implementation::ChatWindowManager> {};
}
