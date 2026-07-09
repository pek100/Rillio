//! Stage 2: mpv render API -> ANGLE (GL over our D3D11 device) -> a D3D11
//! texture -> copied into the composition swapchain -> DirectComposition
//! composites the transparent WebView2 overlay on top.
//!
//! Verification gates (see memory/compositing-dcomp-plan.md):
//!   * Gate B: ANGLE renders a GL clear-color into a texture on OUR device and
//!     it shows under the transparent overlay. (Proves EGL<->D3D11 sharing.)
//!   * Gate C: mpv renders a test video into that same texture.
//!
//! An orange GL clear is drawn before mpv starts so Gate B is observable even if
//! mpv init fails; once mpv is up, frames come from mpv instead.

use std::iter::once;
use std::sync::mpsc;

use windows::core::{Interface, PCWSTR, Result};
use windows::Win32::Foundation::{E_FAIL, E_POINTER, HMODULE, HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows::Win32::Graphics::Direct3D::{D3D_DRIVER_TYPE_HARDWARE, D3D_FEATURE_LEVEL};
use windows::Win32::Graphics::Direct3D11::{
    D3D11CreateDevice, ID3D11Device, ID3D11DeviceContext, ID3D11Texture2D,
    D3D11_BIND_RENDER_TARGET, D3D11_BIND_SHADER_RESOURCE, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
    D3D11_SDK_VERSION, D3D11_TEXTURE2D_DESC, D3D11_USAGE_DEFAULT,
};
use windows::Win32::Graphics::DirectComposition::{
    DCompositionCreateDevice, IDCompositionDevice, IDCompositionTarget, IDCompositionVisual,
};
use windows::Win32::Graphics::Dxgi::Common::{
    DXGI_ALPHA_MODE_IGNORE, DXGI_FORMAT_B8G8R8A8_UNORM, DXGI_FORMAT_UNKNOWN, DXGI_SAMPLE_DESC,
};
use windows::Win32::Graphics::Dxgi::{
    IDXGIDevice, IDXGIFactory2, IDXGISwapChain1, DXGI_PRESENT, DXGI_SCALING_STRETCH,
    DXGI_SWAP_CHAIN_DESC1, DXGI_SWAP_CHAIN_FLAG, DXGI_SWAP_EFFECT_FLIP_SEQUENTIAL,
    DXGI_USAGE_RENDER_TARGET_OUTPUT,
};
use windows::Win32::System::Com::{CoInitializeEx, COINIT_APARTMENTTHREADED};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::HiDpi::{SetProcessDpiAwareness, PROCESS_PER_MONITOR_DPI_AWARE};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DispatchMessageW, GetClientRect, GetMessageW,
    GetWindowLongPtrW, KillTimer, LoadCursorW, PostMessageW, PostQuitMessage, RegisterClassW,
    SetTimer, SetWindowLongPtrW, ShowWindow, TranslateMessage, CW_USEDEFAULT, GWLP_USERDATA,
    IDC_ARROW, MSG, SW_SHOW, WM_APP, WM_DESTROY, WM_ERASEBKGND, WM_LBUTTONDOWN, WM_LBUTTONUP,
    WM_MOUSEMOVE, WM_RBUTTONDOWN, WM_RBUTTONUP, WM_SIZE, WM_TIMER, WNDCLASSW, WS_OVERLAPPEDWINDOW,
};

use webview2_com::Microsoft::Web::WebView2::Win32::{
    CreateCoreWebView2Environment, ICoreWebView2CompositionController, ICoreWebView2Controller,
    ICoreWebView2Controller2, ICoreWebView2Environment, ICoreWebView2Environment3,
    COREWEBVIEW2_COLOR, COREWEBVIEW2_MOUSE_EVENT_KIND, COREWEBVIEW2_MOUSE_EVENT_VIRTUAL_KEYS,
};
use webview2_com::{
    CreateCoreWebView2CompositionControllerCompletedHandler,
    CreateCoreWebView2EnvironmentCompletedHandler,
};

use dcomp_webview_spike::egl::{self, Angle, EGLSurface};
use dcomp_webview_spike::mpvffi::{Mpv, MPV_RENDER_UPDATE_FRAME};

const WM_RENDER: u32 = WM_APP + 1;
const RENDER_TIMER: usize = 1;

struct AppState {
    comp_controller: ICoreWebView2CompositionController,
    controller: ICoreWebView2Controller,
    dcomp: IDCompositionDevice,
    swapchain: IDXGISwapChain1,
    d3d: ID3D11Device,
    ctx: ID3D11DeviceContext,
    angle: Angle,
    surface: EGLSurface,
    mpv_texture: ID3D11Texture2D,
    mpv: Option<Mpv>,
    width: i32,
    height: i32,
    _target: IDCompositionTarget,
    _root: IDCompositionVisual,
    _video_visual: IDCompositionVisual,
    _web_visual: IDCompositionVisual,
}

impl AppState {
    /// Render one frame into `mpv_texture` (via ANGLE), copy it into the
    /// composition swapchain, and present. DComp shows it under the WebView2.
    unsafe fn render(&self) {
        if self.angle.make_current(self.surface).is_err() {
            return;
        }
        match &self.mpv {
            Some(mpv) => mpv.render(0, self.width, self.height),
            None => self.angle.gl_clear_to(self.width, self.height, 1.0, 0.5, 0.12, 1.0),
        }
        // ANGLE wrote mpv_texture on our device; copy it into the back buffer.
        if let Ok(back) = self.swapchain.GetBuffer::<ID3D11Texture2D>(0) {
            self.ctx.CopyResource(&back, &self.mpv_texture);
        }
        let _ = self.swapchain.Present(1, DXGI_PRESENT(0)).ok();
    }

    unsafe fn resize(&mut self, w: i32, h: i32) {
        if w <= 0 || h <= 0 {
            return;
        }
        self.width = w;
        self.height = h;
        // Drop the old EGL surface + texture, remake at the new size.
        self.angle.destroy_surface(self.surface);
        self.surface = std::ptr::null_mut();
        let _ = self
            .swapchain
            .ResizeBuffers(0, w as u32, h as u32, DXGI_FORMAT_UNKNOWN, DXGI_SWAP_CHAIN_FLAG(0));
        if let Ok((tex, surf)) = make_render_target(&self.d3d, &self.angle, w, h) {
            self.mpv_texture = tex;
            self.surface = surf;
        }
        let _ = self.controller.SetBounds(RECT {
            left: 0,
            top: 0,
            right: w,
            bottom: h,
        });
        let _ = self.dcomp.Commit();
        self.render();
    }
}

/// Create a D3D11 render-target texture and wrap it as an ANGLE pbuffer surface.
unsafe fn make_render_target(
    d3d: &ID3D11Device,
    angle: &Angle,
    w: i32,
    h: i32,
) -> Result<(ID3D11Texture2D, EGLSurface)> {
    let desc = D3D11_TEXTURE2D_DESC {
        Width: w as u32,
        Height: h as u32,
        MipLevels: 1,
        ArraySize: 1,
        Format: DXGI_FORMAT_B8G8R8A8_UNORM,
        SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 },
        Usage: D3D11_USAGE_DEFAULT,
        BindFlags: (D3D11_BIND_RENDER_TARGET | D3D11_BIND_SHADER_RESOURCE).0 as u32,
        ..Default::default()
    };
    let mut tex: Option<ID3D11Texture2D> = None;
    d3d.CreateTexture2D(&desc, None, Some(&mut tex))?;
    let tex = tex.unwrap();
    let surf = angle
        .surface_from_texture(tex.as_raw(), w, h)
        .map_err(|e| {
            eprintln!("{e}");
            windows::core::Error::from(E_FAIL)
        })?;
    Ok((tex, surf))
}

/// mpv update callback (runs on mpv's thread): nudge the UI thread to render.
unsafe extern "C" fn on_mpv_update(ctx: *mut std::ffi::c_void) {
    let hwnd = HWND(ctx);
    let _ = PostMessageW(Some(hwnd), WM_RENDER, WPARAM(0), LPARAM(0));
}

fn main() -> Result<()> {
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok()?;
        let _ = SetProcessDpiAwareness(PROCESS_PER_MONITOR_DPI_AWARE);

        let hwnd = create_window()?;
        let (w, h) = client_size(hwnd);
        println!("window {hwnd:?}  client {w}x{h}");

        // --- D3D11 device + composition swapchain --------------------------
        let mut d3d: Option<ID3D11Device> = None;
        let mut ctx: Option<ID3D11DeviceContext> = None;
        D3D11CreateDevice(
            None,
            D3D_DRIVER_TYPE_HARDWARE,
            HMODULE::default(),
            D3D11_CREATE_DEVICE_BGRA_SUPPORT,
            None,
            D3D11_SDK_VERSION,
            Some(&mut d3d),
            Some(&mut D3D_FEATURE_LEVEL::default()),
            Some(&mut ctx),
        )?;
        let d3d = d3d.unwrap();
        let ctx = ctx.unwrap();

        let dxgi_dev: IDXGIDevice = d3d.cast()?;
        let adapter = dxgi_dev.GetAdapter()?;
        let factory: IDXGIFactory2 = adapter.GetParent()?;
        let desc = DXGI_SWAP_CHAIN_DESC1 {
            Width: w as u32,
            Height: h as u32,
            Format: DXGI_FORMAT_B8G8R8A8_UNORM,
            Stereo: false.into(),
            SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 },
            BufferUsage: DXGI_USAGE_RENDER_TARGET_OUTPUT,
            BufferCount: 2,
            Scaling: DXGI_SCALING_STRETCH,
            SwapEffect: DXGI_SWAP_EFFECT_FLIP_SEQUENTIAL,
            AlphaMode: DXGI_ALPHA_MODE_IGNORE,
            Flags: 0,
        };
        let swapchain = factory.CreateSwapChainForComposition(&d3d, &desc, None)?;

        // --- DComp tree ----------------------------------------------------
        let dcomp: IDCompositionDevice = DCompositionCreateDevice(&dxgi_dev)?;
        let target = dcomp.CreateTargetForHwnd(hwnd, true)?;
        let root = dcomp.CreateVisual()?;
        target.SetRoot(&root)?;
        let video_visual = dcomp.CreateVisual()?;
        video_visual.SetContent(&swapchain)?;
        root.AddVisual(&video_visual, true, None)?;
        let web_visual = dcomp.CreateVisual()?;
        root.AddVisual(&web_visual, true, &video_visual)?;

        // --- ANGLE on our device + render target ---------------------------
        let angle = Angle::init(d3d.as_raw()).map_err(|e| {
            eprintln!("ANGLE init failed: {e}");
            windows::core::Error::from(E_FAIL)
        })?;
        println!("ANGLE initialised on our D3D11 device");
        let (mpv_texture, surface) = make_render_target(&d3d, &angle, w, h)?;
        angle.make_current(surface).ok();
        // Gate B: an orange clear before mpv starts.
        angle.gl_clear_to(w, h, 1.0, 0.5, 0.12, 1.0);
        println!("Gate B: ANGLE GL clear rendered into D3D11 texture");

        // --- WebView2 overlay ---------------------------------------------
        let environment = create_environment()?;
        let env3: ICoreWebView2Environment3 = environment.cast()?;
        let comp_controller = create_comp_controller(&env3, hwnd)?;
        comp_controller.SetRootVisualTarget(&web_visual)?;
        let controller: ICoreWebView2Controller = comp_controller.cast()?;
        controller.SetBounds(RECT { left: 0, top: 0, right: w, bottom: h })?;
        controller.SetIsVisible(true)?;
        let controller2: ICoreWebView2Controller2 = controller.cast()?;
        controller2.SetDefaultBackgroundColor(COREWEBVIEW2_COLOR { A: 0, R: 0, G: 0, B: 0 })?;
        navigate_overlay(&controller)?;

        // --- mpv: render context + test source (Gate C) --------------------
        let mpv = match std::env::var("STREMIO_LIBMPV") {
            Ok(path) => match Mpv::load(&path) {
                Ok(mut mpv) => {
                    match mpv.create_render_context(egl::mpv_get_proc_address, angle.loader_ptr()) {
                        Ok(()) => {
                            mpv.set_option("loop-file", "inf");
                            // Keep still images on screen (they're a valid frame
                            // through the full decode->render path).
                            mpv.set_option("image-display-duration", "inf");
                            mpv.set_update_callback(on_mpv_update, hwnd.0);
                            let src = std::env::var("STREMIO_TEST_SRC").unwrap_or_else(|_| {
                                "av://lavfi:testsrc2=size=1280x720:rate=30".to_string()
                            });
                            println!("mpv loadfile {src}");
                            mpv.loadfile(&src);
                            Some(mpv)
                        }
                        Err(e) => {
                            eprintln!("mpv render context failed: {e} (staying on Gate B clear)");
                            None
                        }
                    }
                }
                Err(e) => {
                    eprintln!("mpv load failed: {e} (staying on Gate B clear)");
                    None
                }
            },
            Err(_) => {
                eprintln!("STREMIO_LIBMPV not set — Gate B clear only");
                None
            }
        };

        let state = Box::new(AppState {
            comp_controller,
            controller,
            dcomp: dcomp.clone(),
            swapchain,
            d3d,
            ctx,
            angle,
            surface,
            mpv_texture,
            mpv,
            width: w,
            height: h,
            _target: target,
            _root: root,
            _video_visual: video_visual,
            _web_visual: web_visual,
        });
        state.render();
        dcomp.Commit()?;

        let state_ptr = Box::into_raw(state);
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, state_ptr as isize);

        let _ = ShowWindow(hwnd, SW_SHOW);
        // A steady timer keeps the video layer advancing even if the mpv update
        // callback is quiet (also keeps Gate B visible).
        SetTimer(Some(hwnd), RENDER_TIMER, 16, None);
        println!("entering message loop");

        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).0 > 0 {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
    Ok(())
}

extern "system" fn wndproc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    unsafe {
        let state_ptr = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *mut AppState;
        let state = if state_ptr.is_null() { None } else { Some(&*state_ptr) };
        match msg {
            WM_ERASEBKGND => LRESULT(1),
            WM_TIMER | WM_RENDER => {
                if let Some(state) = state {
                    // Drain mpv's frame flag when it drove this render.
                    if let Some(mpv) = &state.mpv {
                        let _ = mpv.update_flags() & MPV_RENDER_UPDATE_FRAME;
                    }
                    state.render();
                }
                LRESULT(0)
            }
            WM_SIZE => {
                if !state_ptr.is_null() {
                    let w = (lparam.0 & 0xffff) as i32;
                    let h = ((lparam.0 >> 16) & 0xffff) as i32;
                    (*state_ptr).resize(w, h);
                }
                LRESULT(0)
            }
            WM_MOUSEMOVE | WM_LBUTTONDOWN | WM_LBUTTONUP | WM_RBUTTONDOWN | WM_RBUTTONUP => {
                if let Some(state) = state {
                    let x = (lparam.0 & 0xffff) as i16 as i32;
                    let y = ((lparam.0 >> 16) & 0xffff) as i16 as i32;
                    let vkeys = (wparam.0 & 0xffff) as i32;
                    let _ = state.comp_controller.SendMouseInput(
                        COREWEBVIEW2_MOUSE_EVENT_KIND(msg as i32),
                        COREWEBVIEW2_MOUSE_EVENT_VIRTUAL_KEYS(vkeys),
                        0,
                        POINT { x, y },
                    );
                }
                LRESULT(0)
            }
            WM_DESTROY => {
                if !state_ptr.is_null() {
                    let _ = KillTimer(Some(hwnd), RENDER_TIMER);
                    drop(Box::from_raw(state_ptr));
                    SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
                }
                PostQuitMessage(0);
                LRESULT(0)
            }
            _ => DefWindowProcW(hwnd, msg, wparam, lparam),
        }
    }
}

unsafe fn create_window() -> Result<HWND> {
    let hinstance = GetModuleHandleW(None)?;
    let class_name = wide("DCompStage2");
    let title = wide("mpv -> ANGLE -> DComp (Stage 2)");
    let class = WNDCLASSW {
        lpfnWndProc: Some(wndproc),
        hInstance: hinstance.into(),
        hCursor: LoadCursorW(None, IDC_ARROW)?,
        lpszClassName: PCWSTR(class_name.as_ptr()),
        ..Default::default()
    };
    RegisterClassW(&class);
    let hwnd = CreateWindowExW(
        Default::default(),
        PCWSTR(class_name.as_ptr()),
        PCWSTR(title.as_ptr()),
        WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT,
        CW_USEDEFAULT,
        1280,
        800,
        None,
        None,
        Some(hinstance.into()),
        None,
    )?;
    Ok(hwnd)
}

fn create_environment() -> Result<ICoreWebView2Environment> {
    let (tx, rx) = mpsc::channel();
    CreateCoreWebView2EnvironmentCompletedHandler::wait_for_async_operation(
        Box::new(|handler| unsafe {
            CreateCoreWebView2Environment(&handler).map_err(webview2_com::Error::WindowsError)
        }),
        Box::new(move |error_code, environment| {
            error_code?;
            tx.send(environment.ok_or_else(|| windows::core::Error::from(E_POINTER)))
                .expect("send env");
            Ok(())
        }),
    )
    .map_err(to_win_err)?;
    rx.recv().expect("recv env")
}

fn create_comp_controller(
    env3: &ICoreWebView2Environment3,
    hwnd: HWND,
) -> Result<ICoreWebView2CompositionController> {
    let (tx, rx) = mpsc::channel();
    let env3 = env3.clone();
    CreateCoreWebView2CompositionControllerCompletedHandler::wait_for_async_operation(
        Box::new(move |handler| unsafe {
            env3.CreateCoreWebView2CompositionController(hwnd, &handler)
                .map_err(webview2_com::Error::WindowsError)
        }),
        Box::new(move |error_code, controller| {
            error_code?;
            tx.send(controller.ok_or_else(|| windows::core::Error::from(E_POINTER)))
                .expect("send comp controller");
            Ok(())
        }),
    )
    .map_err(to_win_err)?;
    rx.recv().expect("recv comp controller")
}

unsafe fn navigate_overlay(controller: &ICoreWebView2Controller) -> Result<()> {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "\\overlay.html").replace('\\', "/");
    let url = format!("file:///{path}");
    let webview = controller.CoreWebView2()?;
    webview.Navigate(PCWSTR(wide(&url).as_ptr()))?;
    Ok(())
}

unsafe fn client_size(hwnd: HWND) -> (i32, i32) {
    let mut r = RECT::default();
    let _ = GetClientRect(hwnd, &mut r);
    (r.right - r.left, r.bottom - r.top)
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(once(0)).collect()
}

fn to_win_err(e: webview2_com::Error) -> windows::core::Error {
    match e {
        webview2_com::Error::WindowsError(w) => w,
        other => {
            eprintln!("webview2 error: {other:?}");
            windows::core::Error::from(E_FAIL)
        }
    }
}
