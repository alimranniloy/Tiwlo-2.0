use serde::{Deserialize, Serialize};

const MAX_VIDEO_DIMENSION: u32 = 1920;
const MAX_DURATION_SECONDS: f64 = 900.0;

#[derive(Debug, Deserialize)]
pub struct MediaPreflightRequest {
    pub content_type: String,
    pub size_bytes: u64,
    pub duration_seconds: f64,
    pub width: u32,
    pub height: u32,
    pub video_codec: String,
    pub pixel_format: String,
    pub audio_codec: Option<String>,
    pub level: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct MediaPreflightResponse {
    pub valid: bool,
    pub playable: bool,
    pub needs_transcode: bool,
    pub reason: Option<&'static str>,
    pub target_format: &'static str,
    pub target_video_codec: &'static str,
    pub target_pixel_format: &'static str,
    pub target_audio_codec: &'static str,
    pub faststart_required: bool,
}

pub fn preflight(input: MediaPreflightRequest) -> MediaPreflightResponse {
    let content_type = input.content_type.trim().to_ascii_lowercase();
    let video_codec = input.video_codec.trim().to_ascii_lowercase();
    let pixel_format = input.pixel_format.trim().to_ascii_lowercase();
    let audio_codec = input
        .audio_codec
        .as_deref()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();

    let reason = if content_type != "video/mp4" && content_type != "video/quicktime" {
        Some("unsupported_video_container")
    } else if input.size_bytes == 0 {
        Some("empty_video")
    } else if !input.duration_seconds.is_finite()
        || input.duration_seconds <= 0.0
        || input.duration_seconds > MAX_DURATION_SECONDS
    {
        Some("invalid_video_duration")
    } else if input.width == 0
        || input.height == 0
        || input.width > MAX_VIDEO_DIMENSION
        || input.height > MAX_VIDEO_DIMENSION
    {
        Some("unsupported_video_dimensions")
    } else if video_codec.is_empty() || pixel_format.is_empty() {
        Some("missing_video_stream_metadata")
    } else if input.level.is_some_and(|level| level > 41.0) {
        Some("unsupported_h264_level")
    } else {
        None
    };

    let playable = reason.is_none();
    let needs_transcode = playable
        && (content_type != "video/mp4"
            || video_codec != "h264"
            || pixel_format != "yuv420p"
            || (!audio_codec.is_empty() && audio_codec != "aac")
            || input.level.is_some_and(|level| level > 41.0));

    MediaPreflightResponse {
        valid: playable,
        playable,
        needs_transcode,
        reason,
        target_format: "mp4",
        target_video_codec: "h264",
        target_pixel_format: "yuv420p",
        target_audio_codec: "aac",
        faststart_required: true,
    }
}

#[cfg(test)]
mod tests {
    use super::{preflight, MediaPreflightRequest};

    fn request() -> MediaPreflightRequest {
        MediaPreflightRequest {
            content_type: "video/mp4".to_owned(),
            size_bytes: 1024,
            duration_seconds: 12.0,
            width: 1280,
            height: 720,
            video_codec: "h264".to_owned(),
            pixel_format: "yuv420p".to_owned(),
            audio_codec: Some("aac".to_owned()),
            level: Some(4.0),
        }
    }

    #[test]
    fn accepts_mobile_compatible_video_without_transcoding() {
        let result = preflight(request());
        assert!(result.valid);
        assert!(result.playable);
        assert!(!result.needs_transcode);
    }

    #[test]
    fn marks_non_yuv420p_video_for_transcoding() {
        let mut input = request();
        input.pixel_format = "yuv444p".to_owned();
        let result = preflight(input);
        assert!(result.valid);
        assert!(result.needs_transcode);
        assert!(result.faststart_required);
    }

    #[test]
    fn rejects_oversized_video() {
        let mut input = request();
        input.width = 3840;
        let result = preflight(input);
        assert!(!result.valid);
        assert_eq!(result.reason, Some("unsupported_video_dimensions"));
    }
}
