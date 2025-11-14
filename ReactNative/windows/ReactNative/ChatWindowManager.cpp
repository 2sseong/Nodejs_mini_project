#include "pch.h"
#include "ChatWindowManager.h"
#include <winrt/Microsoft.ReactNative.h>
#include <winrt/Microsoft.UI.Xaml.h>

using namespace winrt;
using namespace Microsoft::ReactNative;
using namespace Microsoft::UI::Xaml;

namespace winrt::ChatWindowManager::implementation {

  // DeviceEventEmitter.emit(eventName, payload)
  static void Emit(ReactContext const& ctx, std::wstring const& name, std::string const& roomId) {
    JSValueObject payload; payload["roomId"] = roomId;
    JSValueArray args; args.push_back(JSValue(name)); args.push_back(JSValue(payload));
    ctx.CallJSFunction(L"RCTDeviceEventEmitter", L"emit", JSValue(args));
  }

  void ChatWindowManager::open(std::string roomId,
                               std::optional<std::string> title,
                               ReactPromise<bool> result) noexcept {
    // 반드시 UI 스레드에서 새 창 생성
    m_context.UIDispatcher().Post([this, roomId = std::move(roomId), title = std::move(title), result]() mutable {
      try {
        // 앱의 ReactNativeHost 획득
        auto app = Application::Current().as<IReactApplication>();
        auto host = app.ReactNativeHost();

        // ReactRootView에 Host 연결 + 컴포넌트/초기 프롭
        ReactRootView root;
        root.ReactNativeHost(host);
        root.ComponentName(L"ChatExternalWindow");

        JSValueObject props;
        props["roomId"]   = roomId;
        props["roomName"] = title.value_or("채팅");
        root.InitialProps(JSValue(std::move(props)));

        // 새 Window 생성/활성화
        Window win;
        win.Content(root);
        win.Activate();

        // 이벤트 송출 및 생존 유지
        Emit(m_context, L"ChatWindowOpened", roomId);
        win.Closed([this, rid = roomId, handle = win](auto&&, auto&&) {
          Emit(m_context, L"ChatWindowClosed", rid);
          // 닫히면 벡터에서 제거
          std::erase_if(m_windows, [&](auto const& w){ return w == handle; });
        });
        m_windows.push_back(win);

        result.Resolve(true);
      } catch (...) {
        result.Resolve(false);
      }
    });
  }
}
