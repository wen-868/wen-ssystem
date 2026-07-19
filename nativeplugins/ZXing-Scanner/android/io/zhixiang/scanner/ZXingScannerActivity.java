package io.zhixiang.scanner;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;

/**
 * ZXing 扫码 Activity
 *
 * 功能：
 *  - 自定义相机预览（Camera2 API）
 *  - ZXing 解码器实时分析预览帧
 *  - 扫码框 UI 绘制（支持标题、提示文案）
 *  - 识别成功后回传结果并 finish
 *
 * 注意：
 *  - 本文件为占位源码，实际编译打包由 HBuilderX 云打包处理
 *  - 连续扫码模式下，识别成功后不 finish，继续扫码
 *  - 支持格式：EAN-13/EAN-8/UPC/CODE_128/QR_CODE/DATA_MATRIX 等
 *
 * @author 阿澈
 */
public class ZXingScannerActivity extends Activity {

    private static final String TAG = "ZXingScannerActivity";

    /** 扫码选项 key */
    public static final String EXTRA_OPTIONS = "scan_options";

    /** 扫码结果 key */
    public static final String EXTRA_RESULT_CODE = "result_code";
    public static final String EXTRA_RESULT_FORMAT = "result_format";

    /** 连续扫码间隔（毫秒） */
    private long interval = 1000L;

    /** 是否连续扫码 */
    private boolean continuous = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 占位实现：实际逻辑由云打包后的编译产物提供
        // 开发流程：
        // 1. 解析 EXTRA_OPTIONS 获取扫码选项
        // 2. 初始化 Camera2 预览
        // 3. 初始化 ZXing MultiFormatReader
        // 4. 启动预览帧分析线程
        Log.i(TAG, "onCreate() called");
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        // 释放相机和解码器资源
        Log.i(TAG, "onDestroy() called");
    }

    /**
     * 处理识别到的条码
     * 原生实现：根据 continuous 决定回传后 finish 还是继续扫码
     *
     * @param code   识别到的内容
     * @param format 条码格式（EAN_13/QR_CODE 等）
     */
    private void onCodeScanned(String code, String format) {
        Log.i(TAG, "onCodeScanned: code=" + code + ", format=" + format);
        // 占位实现：实际逻辑由云打包后的编译产物提供
    }
}