// Windows/ChatWindowManager.cs
using Microsoft.ReactNative;
using Microsoft.ReactNative.Managed;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Diagnostics;

namespace ReactNative.Windows
{
  [ReactModule("ChatWindowManager")]
  internal sealed class ChatWindowManager
  {
    private readonly ReactContext _context;
    private readonly List<Window> _windows = new();   // ★ 창 레퍼런스 유지

    public ChatWindowManager(ReactContext context)
    {
      _context = context;
    }

    [ReactMethod("open")]
    public async Task<bool> OpenAsync(string roomId, string roomTitle)
    {
      try
      {
        // UI 스레드 진입
        await _context.Handle.DispatcherQueue.EnqueueAsync(() =>
        {
          var win = new Window();
          win.Title = string.IsNullOrWhiteSpace(roomTitle) ? "채팅" : roomTitle;

          var frame = new Frame();
          win.Content = frame;

          var root = new ReactRootView
          {
            ReactNativeHost = ((App)Application.Current).Host, // Host는 public 이어야 함
            ComponentName = "ChatRoomWindow",
            InitialProps = new JSValueObject
            {
              { "roomId", roomId },
              { "roomTitle", roomTitle ?? "채팅" }
            }
          };

          frame.Content = root;

          // 초기 크기(원하면 배치/위치도 AppWindow로 제어 가능)
          win.Width = 560;
          win.Height = 640;

          _windows.Add(win);     // ★ GC 방지
          win.Closed += (s, e) =>
          {
            _windows.Remove(win);
            Emit("ChatWindowClosed", new JSValueObject { { "roomId", roomId } });
          };

          win.Activate();
        });

        Emit("ChatWindowOpened", new JSValueObject {
          { "roomId", roomId }, { "roomTitle", roomTitle }
        });
        return true;
      }
      catch (System.Exception ex)
      {
        Debug.WriteLine($"[CWM] open failed: {ex}");
        return false;
      }
    }

    private void Emit(string evt, JSValue payload)
    {
      // RNW에서 안전한 채널명 (JS: new NativeEventEmitter(ChatWindowManager) 없어도 수신 가능)
      _context.EmitJSEvent("DeviceEventEmitter", evt, payload);
    }
  }
}
