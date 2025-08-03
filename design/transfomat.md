```
from __future__ import annotations

from collections.abc import Generator
from typing import Any
import orjson
import os
import json
from fastapi.encoders import jsonable_encoder
from datetime import datetime

from langflow.base.io.chat import ChatComponent
from langflow.helpers.data import safe_convert
from langflow.inputs.inputs import BoolInput, DropdownInput, HandleInput, MessageTextInput
from langflow.schema.data import Data
from langflow.schema.dataframe import DataFrame
from langflow.schema.message import Message
from langflow.schema.properties import Source
from langflow.template.field.base import Output
from langflow.utils.constants import MESSAGE_SENDER_AI, MESSAGE_SENDER_USER

class OptimizedRoutingChatOutput(ChatComponent):
    display_name = "Routing Data Output (LCEL Compatible)"
    description = "LCEL-compatible data transformer for SmartRoutingFunction pipeline with LangChain.js export support"
    documentation: str = "https://docs.langflow.org/components-io#chat-output"
    icon = "GitBranch"
    name = "OptimizedRoutingChatOutput"
    minimized = True

    inputs = [
        HandleInput(
            name="lcel_input",
            display_name="LCEL Compatible Input",
            info="LCEL compatible data from OptimizedEnhancedChatInput",
            input_types=["Data", "Message"],
            required=True,
        ),
        BoolInput(
            name="preserve_lcel_format",
            display_name="Preserve LCEL Format",
            info="Maintain LCEL compatibility throughout the chain",
            value=True,
            advanced=False,
        ),
        # 新增的兼容性开关
        BoolInput(
            name="vercel_mode",
            display_name="Vercel Environment Mode",
            info="Enable Vercel environment variable support",
            value=False,
            advanced=True,
        ),
        BoolInput(
            name="langchainjs_export",
            display_name="LangChain.js Export Mode",
            info="Enable LangChain.js compatible export format",
            value=False,
            advanced=True,
        ),
        BoolInput(
            name="flatten_metadata",
            display_name="Flatten Metadata",
            info="Use flattened metadata structure for LCEL compatibility",
            value=True,
            advanced=True,
        ),
        BoolInput(
            name="enable_reassignment_detection",
            display_name="Enable Reassignment Detection",
            info="Enable task reassignment mechanism detection",
            value=True,
            advanced=True,
        ),
        DropdownInput(
            name="output_format",
            display_name="Output Format",
            options=["lcel_compatible", "langflow_standard", "langchainjs_export"],
            value="lcel_compatible",
            info="Choose output format for routing pipeline",
            advanced=False,
        ),
        BoolInput(
            name="should_store_message",
            display_name="Store Messages",
            info="Store the message in the history",
            value=False,
            advanced=True,
        ),
        MessageTextInput(
            name="sender_name",
            display_name="Sender Name",
            info="Name of the sender",
            value="Router",
            advanced=True,
        ),
        MessageTextInput(
            name="session_id",
            display_name="Session ID",
            info="The session ID of the chat",
            advanced=True,
        ),
    ]

    outputs = [
        Output(
            display_name="Routing Ready Message",
            name="routing_ready_message",
            method="get_routing_ready_message",
        ),
    ]

    async def get_routing_ready_message(self) -> Message:
        """转换LCEL输入为SmartRoutingFunction可处理的消息格式"""
        
        try:
            if not self.lcel_input:
                return self._create_error_message("No LCEL input provided")
            
            # 加载环境配置
            env_config = self._load_environment_config()
            
            # 处理LCEL兼容的Data输入
            if isinstance(self.lcel_input, Data):
                return self._process_lcel_data(self.lcel_input, env_config)
            
            # 处理Message输入
            elif isinstance(self.lcel_input, Message):
                return self._process_lcel_message(self.lcel_input, env_config)
            
            else:
                # 其他类型转换为Message
                return self._convert_to_message(self.lcel_input, env_config)
                
        except IndexError as e:
            self.status = f"❌ String index error: {str(e)[:30]}..." if hasattr(self, 'status') else ""
            return self._create_error_message(f"String processing error: {str(e)}")
        except Exception as e:
            self.status = f"❌ Conversion error: {str(e)[:30]}..." if hasattr(self, 'status') else ""
            return self._create_error_message(f"Conversion failed: {str(e)}")

    def _load_environment_config(self) -> dict:
        """加载环境变量配置，支持Vercel模式"""
        
        default_config = {
            "routing_pipeline": {
                "enable_memory_cycle": True,
                "reassignment_threshold": 0.6,
                "max_reassignment_attempts": 3
            },
            "output_formats": {
                "lcel_compatible": True,
                "langchainjs_export": self.langchainjs_export,
                "flatten_metadata": self.flatten_metadata
            },
            "model_fallback": {
                "basic": "gpt-4.1",
                "enhanced": "gpt-4o-mini",
                "rag": "gpt-4o-mini",
                "agent": "gpt-4o"
            }
        }
        
        try:
            if self.vercel_mode:
                # Vercel环境变量
                config_str = os.getenv("LANGFLOW_ROUTING_OUTPUT_CONFIG", "{}")
                vercel_config = json.loads(config_str) if config_str else {}
                default_config.update(vercel_config)
                
                # Vercel特定配置
                default_config["deployment_env"] = "vercel"
                default_config["edge_compatible"] = True
                
            else:
                # 标准环境变量
                config_str = os.getenv("ROUTING_OUTPUT_CONFIG", "{}")
                env_config = json.loads(config_str) if config_str else {}
                default_config.update(env_config)
                
        except (json.JSONDecodeError, TypeError):
            pass
            
        return default_config

    def _process_lcel_data(self, lcel_data: Data, env_config: dict) -> Message:
        """处理来自OptimizedEnhancedChatInput的LCEL Data"""
        try:
            # 安全获取data内容
            if not hasattr(lcel_data, 'data') or not lcel_data.data:
                return self._create_error_message("Invalid LCEL data structure", env_config)
                
            data_content = lcel_data.data
            
            # 提取核心信息
            message_obj = data_content.get("message")
            routing_analysis = data_content.get("routing_analysis", {})
            
            # 检测重指派请求
            reassignment_request = self._detect_reassignment_request(data_content, env_config)
            
            if isinstance(message_obj, Message):
                # 增强现有Message对象
                enhanced_message = message_obj
            else:
                # 创建新Message对象
                text_content = data_content.get("input", "") or (lcel_data.text if hasattr(lcel_data, 'text') else "") or ""
                enhanced_message = Message(
                    text=text_content,
                    sender="user",
                    sender_name=self.sender_name,
                    session_id=self.session_id or (getattr(message_obj, 'session_id', None) if message_obj else None)
                )
            
            # 根据输出格式处理metadata
            if self.output_format == "langchainjs_export" or self.langchainjs_export:
                enhanced_message = self._format_for_langchainjs(enhanced_message, routing_analysis, reassignment_request, env_config)
            elif self.flatten_metadata:
                enhanced_message = self._format_flattened_metadata(enhanced_message, routing_analysis, reassignment_request, env_config)
            else:
                enhanced_message = self._format_nested_metadata(enhanced_message, routing_analysis, reassignment_request, env_config)
            
            # 状态更新
            route_hint = routing_analysis.get("routing_decision", "basic")
            confidence = routing_analysis.get("confidence", 0.5)
            reassignment_status = " [REASSIGN]" if reassignment_request.get("required", False) else ""
            
            if hasattr(self, 'status'):
                self.status = f"✅ LCEL->Routing: {route_hint.upper()} ({confidence:.2f}){reassignment_status}"
            
            return enhanced_message
            
        except Exception as e:
            return self._create_error_message(f"LCEL data processing failed: {str(e)}", env_config)

    def _detect_reassignment_request(self, data_content: dict, env_config: dict) -> dict:
        """检测任务重指派请求"""
        
        if not self.enable_reassignment_detection:
            return {"required": False, "reason": "detection_disabled"}
        
        try:
            routing_analysis = data_content.get("routing_analysis", {})
            confidence = routing_analysis.get("confidence", 1.0)
            threshold = env_config.get("routing_pipeline", {}).get("reassignment_threshold", 0.6)
            
            # 安全获取输入文本
            input_text = data_content.get("input", "")
            if input_text is None:
                input_text = ""
            elif not isinstance(input_text, str):
                input_text = str(input_text)
            
            # 检测条件 - 安全的字符串操作
            explicit_request = False
            if input_text:
                input_lower = input_text.lower()
                explicit_request = "重新" in input_lower or "reassign" in input_lower
            
            conditions = {
                "low_confidence": confidence < threshold,
                "explicit_request": explicit_request,
                "previous_failure": data_content.get("metadata", {}).get("previous_attempt_failed", False),
                "model_inadequate": self._check_inadequate_patterns(input_text)
            }
            
            reassignment_required = any(conditions.values())
            
            if reassignment_required:
                return {
                    "required": True,
                    "reason": [k for k, v in conditions.items() if v],
                    "original_route": routing_analysis.get("routing_decision", "basic"),
                    "suggested_route": self._suggest_reassignment_route(routing_analysis, conditions),
                    "attempt_count": data_content.get("metadata", {}).get("reassignment_attempts", 0) + 1,
                    "timestamp": datetime.now().isoformat()
                }
            
            return {"required": False}
            
        except Exception as e:
            # 如果检测失败，返回安全的默认值
            return {"required": False, "error": str(e)}

    def _check_inadequate_patterns(self, text: str) -> bool:
        """检查模型不足的模式 - 修复字符串索引越界问题"""
        if not text or not isinstance(text, str):
            return False
            
        inadequate_patterns = [
            "不够详细", "需要更多", "不满意", "重新分析", 
            "需要更好的", "inadequate", "insufficient", "need better"
        ]
        
        try:
            text_lower = text.lower()
            return any(pattern in text_lower for pattern in inadequate_patterns)
        except (AttributeError, IndexError, TypeError):
            return False

    def _suggest_reassignment_route(self, original_analysis: dict, conditions: dict) -> str:
        """建议重指派路由"""
        try:
            original_route = original_analysis.get("routing_decision", "basic")
            
            # 升级路由逻辑
            route_hierarchy = ["basic", "enhanced", "rag", "agent"]
            
            if conditions.get("model_inadequate") or conditions.get("explicit_request"):
                # 直接升级到更高级路由
                try:
                    current_index = route_hierarchy.index(original_route)
                    return route_hierarchy[min(current_index + 1, len(route_hierarchy) - 1)]
                except (IndexError, ValueError):
                    return "enhanced"
            elif conditions.get("low_confidence"):
                # 根据置信度决定
                return "enhanced" if original_route == "basic" else "rag"
            else:
                return "enhanced"
        except Exception:
            return "enhanced"  # 安全的默认值

    def _format_for_langchainjs(self, message: Message, routing_analysis: dict, 
                               reassignment_request: dict, env_config: dict) -> Message:
        """格式化为LangChain.js兼容格式"""
        
        try:
            if not hasattr(message, 'metadata'):
                message.metadata = {}
            
            # LangChain.js标准格式的扁平化metadata
            langchainjs_metadata = {
                # 核心路由信息
                "routing_decision": routing_analysis.get("routing_decision", "basic"),
                "confidence": routing_analysis.get("confidence", 0.5),
                "requires_llm_routing": routing_analysis.get("requires_llm_routing", False),
                
                # LangChain.js特定字段
                "type": "routing_message",
                "source": "langflow",
                "component": "OptimizedRoutingChatOutput",
                "version": "1.0",
                "timestamp": datetime.now().isoformat(),
                
                # 重指派信息
                "reassignment_required": reassignment_request.get("required", False),
                "reassignment_reason": reassignment_request.get("reason", []),
                "suggested_route": reassignment_request.get("suggested_route"),
                
                # 兼容性标记
                "lcel_compatible": self.preserve_lcel_format,
                "langchainjs_ready": True,
                "runnable_interface": True,
                
                # 模型配置
                "model_preference": env_config.get("model_fallback", {}).get(routing_analysis.get("routing_decision", "basic"), "gpt-4o-mini"),
                "pipeline_step": "routing_output"
            }
            
            message.metadata = langchainjs_metadata
            return message
            
        except Exception as e:
            # 如果格式化失败，返回基础metadata
            if not hasattr(message, 'metadata'):
                message.metadata = {}
            message.metadata.update({
                "error": f"LangChain.js formatting failed: {str(e)}",
                "fallback_mode": True,
                "routing_decision": "basic"
            })
            return message

    def _format_flattened_metadata(self, message: Message, routing_analysis: dict,
                                  reassignment_request: dict, env_config: dict) -> Message:
        """格式化为扁平化metadata（LCEL兼容）"""
        
        try:
            if not hasattr(message, 'metadata'):
                message.metadata = {}
            
            # 扁平化的路由分析数据，为SmartRoutingFunction准备
            flattened_metadata = {
                # 核心路由信息
                "routing_decision": routing_analysis.get("routing_decision", "basic"),
                "confidence": routing_analysis.get("confidence", 0.5),
                "routing_mode": routing_analysis.get("routing_mode", "auto"),
                "requires_llm_routing": routing_analysis.get("requires_llm_routing", False),
                "pre_analysis_available": True,
                
                # 消息分析信息（扁平化）
                "message_length": routing_analysis.get("message_length", 0),
                "word_count": routing_analysis.get("word_count", 0),
                "is_question": routing_analysis.get("is_question", False),
                "has_code": routing_analysis.get("has_code", False),
                "complexity": routing_analysis.get("complexity", 1),
                "needs_context": routing_analysis.get("needs_context", False),
                "needs_tools": routing_analysis.get("needs_tools", False),
                "language": routing_analysis.get("language", "unknown"),
                
                # 重指派机制
                "reassignment_required": reassignment_request.get("required", False),
                "reassignment_reason": reassignment_request.get("reason", []),
                "suggested_route": reassignment_request.get("suggested_route"),
                "attempt_count": reassignment_request.get("attempt_count", 0),
                
                # LCEL兼容性标记
                "lcel_compatible": self.preserve_lcel_format,
                "component_source": "OptimizedRoutingChatOutput",
                "pipeline_step": "routing_preparation",
                "processed_timestamp": datetime.now().isoformat(),
                
                # 环境配置
                "env_mode": "vercel" if self.vercel_mode else "standard",
                "model_preference": env_config.get("model_fallback", {}).get(routing_analysis.get("routing_decision", "basic"))
            }
            
            message.metadata.update(flattened_metadata)
            return message
            
        except Exception as e:
            # 安全的降级处理
            if not hasattr(message, 'metadata'):
                message.metadata = {}
            message.metadata.update({
                "error": f"Flattened formatting failed: {str(e)}",
                "routing_decision": "basic",
                "lcel_compatible": False
            })
            return message

    def _format_nested_metadata(self, message: Message, routing_analysis: dict,
                               reassignment_request: dict, env_config: dict) -> Message:
        """格式化为嵌套metadata（传统格式）"""
        
        try:
            if not hasattr(message, 'metadata'):
                message.metadata = {}
            
            # 嵌套格式的metadata
            nested_metadata = {
                # 核心路由信息
                "routing_analysis": routing_analysis,
                "routing_hint": routing_analysis.get("routing_decision", "basic"),
                "confidence": routing_analysis.get("confidence", 0.5),
                "pre_analysis_available": True,
                
                # 重指派信息
                "reassignment": reassignment_request,
                
                # LCEL兼容性标记
                "lcel_compatible": self.preserve_lcel_format,
                "component_source": "OptimizedRoutingChatOutput",
                "pipeline_step": "routing_preparation",
                
                # 技术细节
                "original_lcel_data": True,
                "requires_llm_routing": routing_analysis.get("requires_llm_routing", False),
                "model_preference": env_config.get("model_fallback", {}).get(routing_analysis.get("routing_decision", "basic")),
                
                # 环境信息
                "env_config": {
                    "mode": "vercel" if self.vercel_mode else "standard",
                    "flatten_metadata": self.flatten_metadata,
                    "langchainjs_export": self.langchainjs_export
                }
            }
            
            message.metadata.update(nested_metadata)
            return message
            
        except Exception as e:
            # 安全的降级处理
            if not hasattr(message, 'metadata'):
                message.metadata = {}
            message.metadata.update({
                "error": f"Nested formatting failed: {str(e)}",
                "routing_analysis": {"routing_decision": "basic", "confidence": 0.5},
                "lcel_compatible": False
            })
            return message

    def _process_lcel_message(self, message: Message, env_config: dict) -> Message:
        """处理Message输入"""
        try:
            # 直接传递Message，添加转换标记
            if not hasattr(message, 'metadata'):
                message.metadata = {}
            
            # 添加基础路由信息
            base_metadata = {
                "component_source": "OptimizedRoutingChatOutput",
                "lcel_compatible": self.preserve_lcel_format,
                "pipeline_step": "routing_preparation",
                "processed_by_transformer": True,
                "routing_decision": "basic",  # 默认路由
                "confidence": 0.5,
                "reassignment_required": False
            }
            
            if self.flatten_metadata:
                message.metadata.update(base_metadata)
            else:
                message.metadata["routing_transform"] = base_metadata
            
            if hasattr(self, 'status'):
                self.status = f"✅ Message passthrough: {len(message.text) if hasattr(message, 'text') and message.text else 0} chars"
            return message
            
        except Exception as e:
            return self._create_error_message(f"Message processing failed: {str(e)}", env_config)

    def _convert_to_message(self, input_data: Any, env_config: dict) -> Message:
        """转换其他类型为Message"""
        try:
            text_content = str(input_data) if input_data is not None else ""
            
            base_metadata = {
                "component_source": "OptimizedRoutingChatOutput",
                "lcel_compatible": self.preserve_lcel_format,
                "converted_from": type(input_data).__name__,
                "routing_decision": "basic",  # 默认路由
                "confidence": 0.5,
                "reassignment_required": False,
                "pipeline_step": "routing_preparation"
            }
            
            message = Message(
                text=text_content,
                sender="user",
                sender_name=self.sender_name,
                session_id=self.session_id,
                metadata=base_metadata if self.flatten_metadata else {"routing_transform": base_metadata}
            )
            
            if hasattr(self, 'status'):
                self.status = f"✅ Converted: {type(input_data).__name__} -> Message"
            return message
            
        except Exception as e:
            return self._create_error_message(f"Conversion failed: {str(e)}", env_config)

    def _create_error_message(self, error_text: str, env_config: dict = None) -> Message:
        """创建错误消息"""
        
        try:
            error_metadata = {
                "error": True,
                "component_source": "OptimizedRoutingChatOutput",
                "routing_decision": "basic",
                "confidence": 0.3,
                "lcel_compatible": False,
                "reassignment_required": False,
                "error_message": error_text
            }
            
            return Message(
                text=f"Routing conversion error: {error_text}",
                sender="system",
                metadata=error_metadata if self.flatten_metadata else {"error_info": error_metadata}
            )
        except Exception:
            # 最后的安全网
            return Message(
                text=f"Routing conversion error: {error_text}",
                sender="system"
            )

    # 保持与父类兼容的方法
    async def message_response(self) -> Message:
        """兼容性方法"""
        return await self.get_routing_ready_message()

    # Memory处理方法 - 修复字符串索引越界
    def format_memory_for_export(self, memory_message):
        """格式化memory为导出友好的格式 - 修复版本"""
        if not memory_message:
            return None

        # 安全提取ChatMemory内容
        try:
            memory_content = memory_message.text if hasattr(memory_message, 'text') else str(memory_message)
            if not memory_content or not isinstance(memory_content, str):
                return None
        except (AttributeError, TypeError):
            return None

        # 安全解析对话历史
        conversations = []
        try:
            lines = memory_content.split('\n')
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                # 安全的字符串分割操作
                if line.startswith('Human:') or line.startswith('User:'):
                    parts = line.split(':', 1)
                    if len(parts) >= 2 and parts[1].strip():
                        conversations.append({"role": "user", "content": parts[1].strip()})
                elif line.startswith('Assistant:') or line.startswith('AI:'):
                    parts = line.split(':', 1)
                    if len(parts) >= 2 and parts[1].strip():
                        conversations.append({"role": "assistant", "content": parts[1].strip()})
        except (IndexError, AttributeError, TypeError):
            pass

        return {
            "type": "chat_memory",
            "messages": conversations[-10:] if conversations else [],  # 保留最近10轮对话
            "format": "langchain_compatible"
        }

    # 统一的memory metadata格式
    def create_memory_metadata(self, memory_data):
        """创建统一的memory metadata格式"""
        try:
            return {
                "memory": {
                    "has_memory": bool(memory_data),
                    "format": "langflow_chat_memory",
                    "messages": memory_data.get("messages", []) if memory_data else [],
                    "export_ready": True
                },
                "langchain_export": {
                    "memory_compatible": True,
                    "vercel_ready": True
                }
            }
        except Exception:
            return {
                "memory": {
                    "has_memory": False,
                    "format": "langflow_chat_memory",
                    "messages": [],
                    "export_ready": False
                },
                "langchain_export": {
                    "memory_compatible": False,
                    "vercel_ready": False
                }
            }

    def export_to_vercel_config(self) -> dict:
        """导出Vercel兼容配置"""
        try:
            return {
                "component_type": "routing_output",
                "config": {
                    "preserve_lcel_format": self.preserve_lcel_format,
                    "output_format": self.output_format,
                    "langchainjs_export": self.langchainjs_export,
                    "flatten_metadata": self.flatten_metadata,
                    "enable_reassignment_detection": self.enable_reassignment_detection
                },
                "vercel_ready": True,
                "langchainjs_compatible": self.langchainjs_export
            }
        except Exception as e:
            return {
                "component_type": "routing_output",
                "error": str(e),
                "vercel_ready": False
            }

```

