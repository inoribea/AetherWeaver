
​    
    from langflow.custom.custom_component.component import Component
    from langflow.io import (
        BoolInput,
        DropdownInput,
        FileInput,
        MessageTextInput,
        MultilineInput,
        Output,
        MessageInput,
    )
    from langflow.schema.message import Message
    from langflow.schema import Data
    from langflow.base.data.utils import IMG_FILE_TYPES, TEXT_FILE_TYPES
    from langflow.utils.constants import (
        MESSAGE_SENDER_AI,
        MESSAGE_SENDER_NAME_USER,
        MESSAGE_SENDER_USER,
    )
    import json
    import time
    import uuid
    import os
    from typing import Dict, Any, Optional
    from datetime import datetime
    
    
    class OptimizedEnhancedChatInput(Component):
        display_name = "Enhanced Chat Input (LCEL Compatible)"
        description = "LCEL-compatible advanced chat input with intelligent routing and LangChain.js export support"
        icon = "MessagesSquare"
        name = "OptimizedEnhancedChatInput"
    
        inputs = [
            MultilineInput(
                name="input_value",
                display_name="Input Text",
                value="",
                info="Message to be processed for intelligent routing",
            ),
            DropdownInput(
                name="routing_mode",
                display_name="Routing Mode",
                options=["auto", "explicit", "hybrid"],
                value="auto",
                info="Routing analysis mode",
                advanced=False,
            ),
            DropdownInput(
                name="output_format",
                display_name="Output Format", 
                options=["lcel_compatible", "langflow_standard", "openai_format", "langchainjs_export"],
                value="lcel_compatible",
                info="Choose output format for downstream processing",
                advanced=False,
            ),
            BoolInput(
                name="enable_pre_routing",
                display_name="Enable Pre-routing Analysis",
                info="Enable intelligent pre-routing analysis",
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
            MessageTextInput(
                name="explicit_route_hint",
                display_name="Explicit Route Hint",
                info="Optional explicit routing hint (basic/enhanced/rag/agent)",
                value="",
                advanced=True,
            ),
            BoolInput(
                name="should_store_message",
                display_name="Store Messages",
                info="Store the message in the history",
                value=True,
                advanced=True,
            ),
            DropdownInput(
                name="sender",
                display_name="Sender Type",
                options=[MESSAGE_SENDER_AI, MESSAGE_SENDER_USER],
                value=MESSAGE_SENDER_USER,
                info="Type of sender",
                advanced=True,
            ),
            MessageTextInput(
                name="sender_name",
                display_name="Sender Name",
                info="Name of the sender",
                value=MESSAGE_SENDER_NAME_USER,
                advanced=True,
            ),
            MessageTextInput(
                name="session_id",
                display_name="Session ID",
                info="Session ID for conversation tracking",
                advanced=True,
            ),
            FileInput(
                name="files",
                display_name="Files",
                file_types=TEXT_FILE_TYPES + IMG_FILE_TYPES,
                info="Files to be processed with the message",
                advanced=True,
                is_list=True,
            ),
            MessageTextInput(
                name="model_preference",
                display_name="Model Preference", 
                info="Preferred model for routing decision",
                value="gpt-4o-mini",
                advanced=True,
            ),
        ]
        
        outputs = [
            Output(
                display_name="LCEL Compatible Output",
                name="lcel_output",
                method="build_lcel_output",
            ),
        ]
    
        def build_lcel_output(self) -> Data:
            """构建LCEL兼容的输出，支持多种导出格式"""
            
            # 加载环境配置
            env_config = self._load_environment_config()
            
            # 输入验证和标准化
            normalized_input = self._normalize_input(self.input_value)
            if not normalized_input:
                return self._create_error_output("Empty or invalid input", env_config)
            
            try:
                # 执行智能分析
                routing_analysis = self._perform_routing_analysis(normalized_input, env_config)
                
                # 构建基础消息对象
                base_message = self._create_base_message(normalized_input, env_config)
                
                # 根据输出格式和兼容性设置创建相应的数据结构
                if self.langchainjs_export or self.output_format == "langchainjs_export":
                    return self._create_langchainjs_output(base_message, routing_analysis, env_config)
                elif self.output_format == "lcel_compatible":
                    return self._create_lcel_output_format(base_message, routing_analysis, env_config)
                elif self.output_format == "openai_format":
                    return self._create_openai_output(base_message, routing_analysis, env_config)
                else:  # langflow_standard
                    return self._create_standard_output(base_message, routing_analysis, env_config)
                    
            except Exception as e:
                self.status = f"❌ Error: {str(e)[:50]}..."
                return self._create_error_output(str(e), env_config)
    
        def _load_environment_config(self) -> Dict[str, Any]:
            """加载环境变量配置，支持Vercel模式"""
            
            # 默认配置
            default_config = {
                "session_id": f"session_{uuid.uuid4().hex[:8]}",
                "user_id": "anonymous",
                "model_configs": {
                    "basic": {"model": "gpt-4.1", "temperature": 0.1},
                    "enhanced": {"model": "gpt-4o-mini", "temperature": 0.3},
                    "rag": {"model": "gpt-4o-mini", "temperature": 0.2},
                    "agent": {"model": "gpt-4o", "temperature": 0.5}
                },
                "routing_thresholds": {
                    "confidence_threshold": 0.8,
                    "requires_llm_threshold": 0.7
                },
                "export_settings": {
                    "langchainjs_compatible": True,
                    "flatten_metadata": self.flatten_metadata,
                    "include_timestamps": True
                }
            }
            
            try:
                if self.vercel_mode:
                    # Vercel环境变量格式
                    config_str = os.getenv("LANGFLOW_ROUTING_CONFIG", "{}")
                    vercel_config = json.loads(config_str) if config_str else {}
                    
                    # 合并Vercel特定配置
                    vercel_specific = {
                        "deployment_env": "vercel",
                        "edge_function_mode": os.getenv("VERCEL_ENV") == "edge",
                        "region": os.getenv("VERCEL_REGION", "unknown")
                    }
                    default_config.update(vercel_config)
                    default_config.update(vercel_specific)
                    
                else:
                    # 标准环境变量
                    config_str = os.getenv("CHAT_INPUT_CONFIG", "{}")
                    env_config = json.loads(config_str) if config_str else {}
                    default_config.update(env_config)
                    
            except (json.JSONDecodeError, TypeError) as e:
                self.status = f"⚠️ Config parse error, using defaults: {str(e)[:30]}"
                
            return default_config
    
        def _normalize_input(self, input_text: Any) -> str:
            """输入标准化和验证"""
            if input_text is None:
                return ""
            
            if not isinstance(input_text, str):
                input_text = str(input_text)
            
            # 基础清理
            normalized = input_text.strip()
            
            # 处理空输入
            if not normalized:
                return "空消息"
                
            return normalized
    
        def _perform_routing_analysis(self, message: str, env_config: Dict[str, Any]) -> Dict[str, Any]:
            """执行智能路由分析，支持环境配置"""
            
            # 基础统计分析
            base_analysis = self._analyze_message_basics(message)
            
            # 获取路由阈值配置
            thresholds = env_config.get("routing_thresholds", {})
            confidence_threshold = thresholds.get("confidence_threshold", 0.8)
            
            # 路由模式处理
            if self.routing_mode == "explicit" and self.explicit_route_hint:
                route_decision = self._validate_explicit_route(self.explicit_route_hint)
                confidence = 0.95
            elif self.routing_mode == "auto":
                route_decision, confidence = self._smart_route_analysis(message, base_analysis, env_config)
            else:  # hybrid
                auto_route, auto_conf = self._smart_route_analysis(message, base_analysis, env_config)
                if self.explicit_route_hint:
                    explicit_route = self._validate_explicit_route(self.explicit_route_hint)
                    route_decision = explicit_route if auto_conf < confidence_threshold else auto_route
                    confidence = max(auto_conf, 0.85)
                else:
                    route_decision, confidence = auto_route, auto_conf
            
            # 构建扁平化的路由分析结果（LCEL兼容）
            if self.flatten_metadata:
                routing_analysis = self._create_flattened_analysis(
                    base_analysis, route_decision, confidence, env_config
                )
            else:
                routing_analysis = self._create_nested_analysis(
                    base_analysis, route_decision, confidence, env_config
                )
            
            return routing_analysis
    
        def _create_flattened_analysis(self, base_analysis: Dict[str, Any], 
                                      route_decision: str, confidence: float, 
                                      env_config: Dict[str, Any]) -> Dict[str, Any]:
            """创建扁平化的分析结果，符合LCEL标准"""
            
            timestamp = datetime.now().isoformat()
            requires_llm = confidence < env_config.get("routing_thresholds", {}).get("requires_llm_threshold", 0.7)
            
            return {
                # 核心路由信息（扁平化）
                "routing_decision": route_decision,
                "confidence": confidence,
                "routing_mode": self.routing_mode,
                "requires_llm_routing": requires_llm,
                "analysis_timestamp": timestamp,
                
                # 基础分析信息（扁平化）
                "message_length": base_analysis.get("length", 0),
                "word_count": base_analysis.get("word_count", 0),
                "is_question": base_analysis.get("is_question", False),
                "has_code": base_analysis.get("has_code", False),
                "complexity": base_analysis.get("complexity", 1),
                "needs_context": base_analysis.get("needs_context", False),
                "needs_tools": base_analysis.get("needs_tools", False),
                "language": base_analysis.get("language", "unknown"),
                
                # 路由元数据（扁平化）
                "priority": self._determine_priority(route_decision, confidence),
                "estimated_tokens": self._estimate_tokens(base_analysis.get("length", 0)),
                "model_config": env_config.get("model_configs", {}).get(route_decision, {}),
                
                # 处理标记
                "component_source": "OptimizedEnhancedChatInput",
                "lcel_compatible": True,
                "langchainjs_ready": self.langchainjs_export
            }
    
        def _create_nested_analysis(self, base_analysis: Dict[str, Any], 
                                   route_decision: str, confidence: float, 
                                   env_config: Dict[str, Any]) -> Dict[str, Any]:
            """创建嵌套的分析结果（传统格式）"""
            
            return {
                **base_analysis,
                "routing_decision": route_decision,
                "confidence": confidence,
                "routing_mode": self.routing_mode,
                "analysis_timestamp": datetime.now().isoformat(),
                "requires_llm_routing": confidence < env_config.get("routing_thresholds", {}).get("requires_llm_threshold", 0.7),
                "routing_metadata": {
                    "input_length": base_analysis.get("length", 0),
                    "complexity_score": base_analysis.get("complexity", 1),
                    "priority": self._determine_priority(route_decision, confidence),
                    "estimated_tokens": self._estimate_tokens(base_analysis.get("length", 0)),
                    "model_config": env_config.get("model_configs", {}).get(route_decision, {})
                }
            }
    
        def _smart_route_analysis(self, message: str, base_analysis: Dict[str, Any], 
                                 env_config: Dict[str, Any]) -> tuple:
            """智能路由分析，支持环境配置"""
            
            text_lower = message.lower()
            
            # 从环境配置获取路由条件，如果没有则使用默认
            route_conditions = env_config.get("route_conditions", {
                "basic": {
                    "keywords": ["简单", "快速", "直接", "什么是", "怎么样", "hello", "hi", "你好"],
                    "base_confidence": 0.85
                },
                "enhanced": {
                    "keywords": ["分析", "详细", "深入", "全面", "比较", "评估", "策略", "复杂", "专业", "高级"],
                    "base_confidence": 0.8
                },
                "rag": {
                    "keywords": ["查找", "搜索", "文档", "资料", "数据库", "知识库", "历史", "之前", "记录", "档案"],
                    "base_confidence": 0.9
                },
                "agent": {
                    "keywords": ["执行", "调用", "工具", "计算", "运行", "处理", "操作", "自动"],
                    "base_confidence": 0.85
                }
            })
            
            best_route = "basic"
            max_confidence = 0.6
            
            # 条件路由评估
            for route_name, route_config in route_conditions.items():
                confidence = route_config["base_confidence"]
                
                # 关键词匹配
                keyword_matches = sum(1 for keyword in route_config["keywords"] if keyword in text_lower)
                if keyword_matches > 0:
                    confidence += min(0.1, keyword_matches * 0.03)
                
                # 条件函数评估
                try:
                    if self._check_route_conditions(route_name, base_analysis):
                        confidence += 0.1
                except:
                    pass
                
                # 选择最高置信度的路由
                if confidence > max_confidence:
                    max_confidence = confidence
                    best_route = route_name
            
            return best_route, min(0.95, max_confidence)
    
        def _analyze_message_basics(self, message: str) -> Dict[str, Any]:
            """基础消息分析"""
            
            text_lower = message.lower()
            words = message.split()
            
            analysis = {
                "length": len(message),
                "word_count": len(words),
                "is_question": "?" in message,
                "has_code": False,
                "complexity": 1,
                "needs_context": False,
                "needs_tools": False,
                "language": "chinese" if any('\u4e00' <= c <= '\u9fff' for c in message) else "english",
            }
            
            # 代码检测
            code_patterns = ["```", "def ", "class ", "import ", "function(", "代码", "函数"]
            analysis["has_code"] = any(pattern in text_lower for pattern in code_patterns)
            
            # 问题类型检测  
            question_patterns = ["什么", "怎么", "为什么", "如何", "哪里", "when", "what", "how", "why", "where", "是否", "能否"]
            analysis["is_question"] = analysis["is_question"] or any(q in text_lower for q in question_patterns)
            
            # 复杂度评估
            if len(message) > 500:
                analysis["complexity"] = 3
            elif len(message) > 200:
                analysis["complexity"] = 2
                
            # 上下文需求检测
            context_keywords = ["历史", "之前", "文档", "资料", "记录", "上次", "前面", "以前", "查找", "搜索", "记住", "回忆"]
            analysis["needs_context"] = any(keyword in text_lower for keyword in context_keywords)
            
            # 工具需求检测
            tool_keywords = ["计算", "搜索", "查询", "分析", "执行", "调用", "运行", "处理", "生成", "翻译"]
            analysis["needs_tools"] = any(keyword in text_lower for keyword in tool_keywords)
            
            return analysis
    
        def _check_route_conditions(self, route_name: str, analysis: Dict[str, Any]) -> bool:
            """检查路由条件"""
            if route_name == "basic":
                return analysis["complexity"] == 1 and not analysis["needs_tools"] and not analysis["needs_context"]
            elif route_name == "enhanced":
                return analysis["complexity"] >= 2 or analysis["has_code"]
            elif route_name == "rag":
                return analysis["needs_context"]
            elif route_name == "agent":
                return analysis["needs_tools"]
            return False
    
        def _validate_explicit_route(self, hint: str) -> str:
            """验证显式路由提示"""
            valid_routes = ["basic", "enhanced", "rag", "agent", "complex"]
            hint_lower = hint.lower().strip()
            
            if hint_lower in valid_routes:
                return hint_lower
            
            # 模糊匹配
            route_mapping = {
                "简单": "basic", "基础": "basic", "快速": "basic",
                "增强": "enhanced", "复杂": "enhanced", "高级": "enhanced",
                "检索": "rag", "搜索": "rag", "文档": "rag",
                "代理": "agent", "工具": "agent", "执行": "agent"
            }
            
            return route_mapping.get(hint_lower, "basic")
    
        def _determine_priority(self, route: str, confidence: float) -> str:
            """确定处理优先级"""
            priority_map = {
                "basic": "low",
                "enhanced": "high", 
                "rag": "medium",
                "agent": "high",
                "complex": "critical"
            }
            
            base_priority = priority_map.get(route, "normal")
            
            # 根据置信度调整优先级
            if confidence < 0.7:
                return "normal"
            
            return base_priority
    
        def _estimate_tokens(self, length: int) -> int:
            """估算token数量"""
            # 简化的token估算
            return max(1, int(length / 4))
    
        def _create_base_message(self, message: str, env_config: Dict[str, Any]) -> Message:
            """创建基础消息对象"""
            session_id = self.session_id or env_config.get("session_id", f"session_{uuid.uuid4().hex[:8]}")
            
            base_message = Message(
                text=message,
                sender=self.sender,
                sender_name=self.sender_name,
                session_id=session_id,
            )
            
            # 安全的文件处理
            if self.files:
                validated_files = []
                for file in self.files:
                    try:
                        if hasattr(file, 'name') and file.name:
                            validated_files.append(file)
                    except Exception:
                        continue
                base_message.files = validated_files
                
            return base_message
    
        def _create_langchainjs_output(self, message: Message, analysis: Dict[str, Any], 
                                      env_config: Dict[str, Any]) -> Data:
            """创建LangChain.js兼容的输出格式"""
            
            # LangChain.js标准格式
            langchainjs_data = {
                # 标准Runnable接口
                "input": message.text,
                "metadata": analysis,  # 扁平化的元数据
                
                # LangChain.js特定字段
                "type": "chat_input",
                "source": "langflow",
                "version": "1.0",
                "timestamp": datetime.now().isoformat(),
                
                # 路由信息
                "routing": {
                    "decision": analysis["routing_decision"],
                    "confidence": analysis["confidence"],
                    "mode": analysis["routing_mode"]
                },
                
                # 消息信息
                "message": {
                    "content": message.text,
                    "role": "user",
                    "session_id": message.session_id,
                    "sender": message.sender
                },
                
                # 处理配置
                "config": {
                    "model": env_config.get("model_configs", {}).get(analysis["routing_decision"], {}).get("model", self.model_preference),
                    "temperature": env_config.get("model_configs", {}).get(analysis["routing_decision"], {}).get("temperature", 0.3)
                }
            }
            
            self.status = f"🔗 LangChain.js Ready: {analysis['routing_decision'].upper()} (conf: {analysis['confidence']:.2f})"
            
            return Data(
                data=langchainjs_data,
                text=message.text
            )
    
        def _create_lcel_output_format(self, message: Message, analysis: Dict[str, Any], 
                                      env_config: Dict[str, Any]) -> Data:
            """创建LCEL兼容的输出格式"""
            
            # LCEL兼容的数据结构
            lcel_data = {
                # 标准LCEL输入格式
                "input": message.text,
                "message": message,
                
                # 扁平化的路由分析结果  
                **analysis,
                
                # 为下游RunnableLambda准备的条件数据
                "conditions": {
                    "is_basic": analysis["routing_decision"] == "basic",
                    "is_enhanced": analysis["routing_decision"] == "enhanced", 
                    "is_rag": analysis["routing_decision"] == "rag",
                    "is_agent": analysis["routing_decision"] == "agent",
                    "needs_llm_analysis": analysis["requires_llm_routing"]
                },
                
                # 环境配置信息
                "env_mode": "vercel" if self.vercel_mode else "standard"
            }
            
            self.status = f"✅ LCEL Ready: {analysis['routing_decision'].upper()} (conf: {analysis['confidence']:.2f})"
            
            return Data(
                data=lcel_data,
                text=message.text
            )
    
        def _create_openai_output(self, message: Message, analysis: Dict[str, Any], 
                                 env_config: Dict[str, Any]) -> Data:
            """创建OpenAI格式兼容的输出"""
            
            model_config = env_config.get("model_configs", {}).get(analysis["routing_decision"], {})
            
            openai_data = {
                "messages": [{
                    "role": "user",
                    "content": message.text,
                    "metadata": analysis if self.flatten_metadata else {"routing_hint": analysis["routing_decision"]}
                }],
                "model": model_config.get("model", self.model_preference),
                "temperature": model_config.get("temperature", 0.3),
                "routing_context": analysis,
                "stream": False
            }
            
            self.status = f"🔄 OpenAI Format: {analysis['routing_decision']} ready"
            
            return Data(data=openai_data)
    
        def _create_standard_output(self, message: Message, analysis: Dict[str, Any], 
                                   env_config: Dict[str, Any]) -> Data:
            """创建标准LangFlow输出格式"""
            return Data(
                data={
                    "type": "enhanced_chat_input",
                    "message": message,
                    "routing_analysis": analysis,
                    "timestamp": datetime.now().isoformat(),
                    "env_config": env_config if not env_config.get("exclude_env_from_output") else {}
                }
            )
    
        def _create_error_output(self, error_msg: str, env_config: Dict[str, Any]) -> Data:
            """创建错误输出"""
            error_message = Message(
                text=f"输入处理错误: {error_msg}",
                sender="system"
            )
            
            # 错误时的基础路由分析
            basic_analysis = {
                "routing_decision": "basic",
                "confidence": 0.5,
                "requires_llm_routing": False,
                "error": True,
                "error_message": error_msg
            }
            
            return Data(
                data={
                    "type": "error",
                    "message": error_message,
                    "routing_analysis": basic_analysis,
                    "timestamp": datetime.now().isoformat()
                }
            )
        # 在你的组件中添加memory处理方法
        def format_memory_for_export(self, memory_message):
            """格式化memory为导出友好的格式"""
            if not memory_message:
                return None
    
            # 提取ChatMemory内容
            memory_content = memory_message.text if hasattr(memory_message, 'text') else str(memory_message)
    
            # 解析对话历史
            conversations = []
            lines = memory_content.split('\n')
            for line in lines:
                if line.startswith('Human:') or line.startswith('User:'):
                    conversations.append({"role": "user", "content": line.split(':', 1)[1].strip()})
                elif line.startswith('Assistant:') or line.startswith('AI:'):
                    conversations.append({"role": "assistant", "content": line.split(':', 1)[1].strip()})
    
            return {
                "type": "chat_memory",
                "messages": conversations[-10:],  # 保留最近10轮对话
                "format": "langchain_compatible"
            }
        # 统一的memory metadata格式
        def create_memory_metadata(self, memory_data):
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
    