// windows/{{namespace}}/Modules/ChatWindowManager.cs
using Microsoft.ReactNative;
using Microsoft.ReactNative.Managed;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Windows.ApplicationModel.Core;
using Windows.UI.Core;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;

namespace ReactNative.Modules
{
  [ReactModule("ChatWindowManager")]
  internal sealed class ChatWindowManager
  {
    private static readonly Dictionary<string, int> _viewIds = new Dictionary<string, int>();

    // 현재 앱의 ReactNativeHost 얻기
    private ReactNativeHost Host => ((App)Application.Current).Host;

    [ReactMethod("open")]
    public async void Open(string roomId, string title, IReactPromise<bool> promise)
    {
      if (string.IsNullOrWhiteSpace(roomId))
      {
        promise.Reject(new Exception("roomId required"));
        return;
      }

      // 이미 열려 있으면 포커스
      if (_viewIds.TryGetValue(roomId, out var existingId))
      {
        await ApplicationViewSwitcher.TryShowAsStandaloneAsync(existingId);
        promise.Resolve(true);
        return;
      }

      var newView = CoreApplication.CreateNewView();
      int newViewId = 0;

      await newView.Dispatcher.RunAsync(CoreDispatcherPriority.Normal, () =>
      {
        // RN RootView 생성
        var root = new ReactRootView();
        root.ReactNativeHost = Host;
        root.ComponentName = "ChatRoomWindow"; // JS에서 등록한 이름
        // 초기 Props 전달
        root.InitialProps = JSValueObject.FromJsonString($"{{\"roomId\":\"{roomId}\"}}");

        var frame = new Frame();
        frame.Content = root;
        Window.Current.Content = frame;
        Window.Current.Activate();

        var appView = Windows.UI.ViewManagement.ApplicationView.GetForCurrentView();
        appView.Title = string.IsNullOrWhiteSpace(title) ? $"채팅 {roomId}" : title;

        newViewId = Windows.UI.ViewManagement.ApplicationView.GetForCurrentView().Id;
      });

      _viewIds[roomId] = newViewId;

      // 새 창을 독립으로 표시
      await Windows.UI.ViewManagement.ApplicationViewSwitcher.TryShowAsStandaloneAsync(newViewId);
      promise.Resolve(true);
    }

    [ReactMethod("close")]
    public async void Close(string roomId)
    {
      if (!_viewIds.TryGetValue(roomId, out var viewId)) return;

      await CoreApplication.MainView.CoreWindow.Dispatcher.RunAsync(CoreDispatcherPriority.Normal, async () =>
      {
        await Windows.UI.ViewManagement.ApplicationViewSwitcher.SwitchAsync(
          CoreApplication.MainView.Id, viewId,
          Windows.UI.ViewManagement.ApplicationViewSwitchingOptions.ConsolidateViews);

        _viewIds.Remove(roomId);
      });
    }

    [ReactMethod("focus")]
    public async void Focus(string roomId)
    {
      if (_viewIds.TryGetValue(roomId, out var viewId))
      {
        await Windows.UI.ViewManagement.ApplicationViewSwitcher.TryShowAsStandaloneAsync(viewId);
      }
    }
  }
}
