package com.example.rbac.config;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

@Configuration
public class JacksonConfig {

    private static final String DATE_TIME_PATTERN = "yyyy-MM-dd HH:mm:ss";
    private static final String DATE_PATTERN = "yyyy-MM-dd";

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern(DATE_TIME_PATTERN);
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern(DATE_PATTERN);

    @Bean
    @Primary
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();

        JavaTimeModule module = new JavaTimeModule();

        module.addSerializer(LocalDateTime.class, new LocalDateTimeSerializer(DATE_TIME_FORMATTER));
        module.addDeserializer(LocalDateTime.class, new JsonDeserializer<>() {
            @Override
            public LocalDateTime deserialize(JsonParser parser, DeserializationContext context) throws IOException {
                String text = parser.getText();
                if (text == null || text.trim().isEmpty()) {
                    return null;
                }
                text = text.trim();
                try {
                    return LocalDateTime.parse(text, DATE_TIME_FORMATTER);
                } catch (DateTimeParseException ignored) {
                    return LocalDate.parse(text, DATE_FORMATTER).atStartOfDay();
                }
            }
        });

        module.addSerializer(LocalDate.class, new LocalDateSerializer(DATE_FORMATTER));
        module.addDeserializer(LocalDate.class, new JsonDeserializer<>() {
            @Override
            public LocalDate deserialize(JsonParser parser, DeserializationContext context) throws IOException {
                String text = parser.getText();
                if (text == null || text.trim().isEmpty()) {
                    return null;
                }
                text = text.trim();
                try {
                    return LocalDate.parse(text, DATE_FORMATTER);
                } catch (DateTimeParseException ignored) {
                    return LocalDateTime.parse(text, DATE_TIME_FORMATTER).toLocalDate();
                }
            }
        });

        mapper.registerModule(module);
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        return mapper;
    }

    /**
     * 反序列化：前端传 String 或 Array 都能接
     * String → 原样返回
     * Array  → join(",") 成字符串
     */
    public static class StringOrArrayDeserializer extends JsonDeserializer<String> {
        @Override
        public String deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
            if (p.currentToken() == JsonToken.VALUE_NULL) {
                return null;
            }
            if (p.currentToken() == JsonToken.START_ARRAY) {
                List<String> list = p.readValueAs(new TypeReference<List<String>>() {});
                if (list == null || list.isEmpty()) return null;
                return list.stream().filter(s -> s != null && !s.isEmpty()).collect(Collectors.joining(","));
            }
            return p.getValueAsString();
        }
    }

    /**
     * 序列化：把逗号分隔的 String 转成 Array 返回给前端
     * 空字符串/null → []
     * "a,b,c"        → ["a", "b", "c"]
     */
    public static class StringToArraySerializer extends JsonSerializer<String> {
        @Override
        public void serialize(String value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
            if (value == null || value.isEmpty()) {
                gen.writeStartArray();
                gen.writeEndArray();
                return;
            }
            String[] parts = value.split(",");
            gen.writeStartArray();
            for (String part : parts) {
                gen.writeString(part.trim());
            }
            gen.writeEndArray();
        }
    }
}