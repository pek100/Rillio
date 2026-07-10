/// Fixed-size byte arrays as strict hexadecimal strings.
///
/// The addon wire format for a torrent `infoHash` is exactly `2 * N` hex
/// characters, unprefixed. Serialization emits lowercase; deserialization
/// accepts either case, and accepts the hex as a string or as raw ASCII bytes,
/// but rejects a `0x` prefix and any other length.
pub mod strict_hex {
    use core::fmt;

    use serde::{
        de::{Error as DeError, Visitor},
        Deserializer, Serializer,
    };

    pub fn serialize<const N: usize, S>(value: &[u8; N], serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&hex::encode(value))
    }

    pub fn deserialize<'de, const N: usize, D>(deserializer: D) -> Result<[u8; N], D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_any(StrictHexVisitor::<N>)
    }

    struct StrictHexVisitor<const N: usize>;

    impl<const N: usize> StrictHexVisitor<N> {
        fn decode<E: DeError>(hex_chars: &[u8]) -> Result<[u8; N], E> {
            let mut bytes = [0_u8; N];
            hex::decode_to_slice(hex_chars, &mut bytes).map_err(E::custom)?;

            Ok(bytes)
        }
    }

    impl<'de, const N: usize> Visitor<'de> for StrictHexVisitor<N> {
        type Value = [u8; N];

        fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(formatter, "a {}-character hex string", N * 2)
        }

        fn visit_str<E: DeError>(self, value: &str) -> Result<Self::Value, E> {
            Self::decode(value.as_bytes())
        }

        fn visit_bytes<E: DeError>(self, value: &[u8]) -> Result<Self::Value, E> {
            Self::decode(value)
        }
    }

    #[cfg(test)]
    mod test {
        use serde::{Deserialize, Serialize};

        #[derive(Debug, Deserialize, Serialize, PartialEq, Eq)]
        struct TestStruct {
            #[serde(with = "super")]
            field: [u8; 4],
        }

        #[test]
        fn test_roundtrip_is_lowercase_and_unprefixed() {
            let test_struct = TestStruct {
                field: [0x00, 0x0f, 0xff, 0x11],
            };
            let json = serde_json::json!({ "field": "000fff11" });

            assert_eq!(
                json,
                serde_json::to_value(&test_struct).expect("Should serialize")
            );
            assert_eq!(
                test_struct,
                serde_json::from_value::<TestStruct>(json).expect("Valid json")
            );
        }

        #[test]
        fn test_deserialize_accepts_uppercase() {
            let upper = serde_json::json!({ "field": "000FFF11" });

            assert_eq!(
                TestStruct {
                    field: [0x00, 0x0f, 0xff, 0x11]
                },
                serde_json::from_value::<TestStruct>(upper).expect("Valid json")
            );
        }

        #[test]
        fn test_deserialize_rejects_bad_input() {
            for bad in ["", "0x", "0x000fff11", "000fff1", "000fff1122", "000fff1g"] {
                let json = serde_json::json!({ "field": bad });
                serde_json::from_value::<TestStruct>(json)
                    .expect_err(&format!("{bad:?} should not deserialize"));
            }
        }
    }
}

pub mod empty_string_as_null {
    use serde::{self, Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(value: &Option<String>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match *value {
            None => serializer.serialize_str(""),
            Some(ref s) => serializer.serialize_str(s),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = Option::<String>::deserialize(deserializer)?;
        match s {
            Some(s) if !s.is_empty() => Ok(Some(s)),
            _ => Ok(None),
        }
    }

    #[cfg(test)]
    mod test {

        use serde::{Deserialize, Serialize};
        #[derive(Debug, Deserialize, Serialize, PartialEq, Eq)]
        struct TestStruct {
            #[serde(with = "super")]
            field: Option<String>,
        }
        #[test]
        fn test_empty_field() {
            let empty_string = serde_json::json!({
                "field": ""
            });

            let test_struct = TestStruct { field: None };

            let null_json = serde_json::json!({
                "field":null,
            });

            assert_eq!(
                test_struct,
                serde_json::from_value::<TestStruct>(empty_string.clone()).expect("Valid Json")
            );
            assert_eq!(
                empty_string,
                serde_json::to_value(&test_struct).expect("Should serialize")
            );
            assert_eq!(
                test_struct,
                serde_json::from_value::<TestStruct>(null_json.clone()).expect("Should serialize")
            );
        }
        #[test]
        fn test_field() {
            let string = serde_json::json!({
                "field": "https://example.com"
            });

            let test_struct = TestStruct {
                field: Some("https://example.com".to_string()),
            };

            assert_eq!(
                test_struct,
                serde_json::from_value::<TestStruct>(string.clone()).expect("Valid Json")
            );
            assert_eq!(
                string,
                serde_json::to_value(test_struct).expect("Should serialize")
            );
        }
    }
}
