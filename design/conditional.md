    import re
    import os
    import json
    from typing import Dict, Any, Optional, List
    from datetime import datetime
    
    from langchain_core.runnables import Runnable, RunnableLambda, RunnablePassthrough
     
    from langflow.custom.custom_component.component import Component
    from langflow.io import BoolInput, DropdownInput, MessageInput, Output, MessageTextInput
    from langflow.schema.message import Message
    
    class OptimizedEnhancedConditionalRouter(Component, Runnable):
        display_name = "Enhanced Conditional Router (LCEL/LangChain.js Compatible)"
        description = "LCEL-compatible intelligent conditional router with metadata support, confidence thresholds and LangChain.js export"
        documentation: str = "https://docs.langflow.org/components-logic#conditional-router-if-else-component"
        icon = "split"
        name = "OptimizedEnhancedConditionalRouter"
    
        inputs = [
            MessageInput(
                name="routing_message",
                display_name="Routing Decision Message",
                info="The routing decision message from OptimizedSmartRoutingFunction",
                required=True,
            ),
            DropdownInput(
                name="match_route",
                display_name="Target Route",
                options=["basic", "enhanced", "rag", "agent"],
                value="basic",
                info="Select the route to match for this conditional branch",
                real_time_refresh=True,
            ),
            DropdownInput(
                name="matching_strategy",
                display_name="Matching Strategy",
                options=[
                    "exact_match",
                    "metadata_priority", 
                    "confidence_aware",
                    "smart_flexible",
                    "langchainjs_compatible"
                ],
                info="Strategy for route matching",
                value="smart_flexible",
                real_time_refresh=True,
            ),
            # 新增兼容性开关
            BoolInput(
                name="vercel_mode",
                display_name="Vercel Environment Mode",
                value=False,
                info="Enable Vercel environment variable support for deployment",
                advanced=True,
            ),
            BoolInput(
                name="langchainjs_export",
                display_name="LangChain.js Export Mode",
                value=False,
                info="Enable LangChain.js compatible routing logic and export",
                advanced=True,
            ),
            BoolInput(
                name="flatten_metadata",
                display_name="Flatten Metadata",
                value=True,
                info="Use flattened metadata structure for LCEL compatibility",
                advanced=True,
            ),
            BoolInput(
                name="enable_runnable_interface",
                display_name="Enable Runnable Interface",
                value=True,
                info="Make component fully LCEL Runnable compatible",
                advanced=True,
            ),
            BoolInput(
                name="support_reassignment",
                display_name="Support Reassignment",
                value=True,
                info="Support task reassignment mechanism",
                advanced=True,
            ),
            BoolInput(
                name="support_memory_routing",
                display_name="Support Memory Routing",
                value=True,
                info="Support ChatMemory and custom memory routing",
                advanced=True,
            ),
            MessageTextInput(
                name="confidence_threshold",
                display_name="Confidence Threshold",
                info="Minimum confidence required (0.0-1.0)",
                value="0.6",
                advanced=True,
            ),
            BoolInput(
                name="case_sensitive",
                display_name="Case Sensitive",
                info="If true, text comparison will be case sensitive",
                value=False,
                advanced=True,
            ),
            BoolInput(
                name="enable_fallback_matching",
                display_name="Enable Fallback Matching",
                info="Allow matching similar routes when exact match fails",
                value=True,
                advanced=True,
            ),
        ]
    
        outputs = [
            Output(
                display_name="Route Match",
                name="route_match",
                method="get_route_match",
                group_outputs=True
            ),
            Output(
                display_name="Route Block",
                name="route_block", 
                method="get_route_block",
                group_outputs=True
            ),
        ]
    
        def _load_environment_config(self) -> Dict[str, Any]:
            """加载环境变量配置，支持Vercel模式"""
            
            default_config = {
                "matching_strategies": {
                    "exact_match": {"strict": True, "fallback": False},
                    "metadata_priority": {"prefer_metadata": True, "text_fallback": True},
                    "confidence_aware": {"threshold_required": True, "dynamic_threshold": False},
                    "smart_flexible": {"multi_level": True, "adaptive": True},
                    "langchainjs_compatible": {"runnable_interface": True, "flatten_output": True}
                },
                "route_similarities": {
                    "basic": ["simple", "easy", "quick", "fast"],
                    "enhanced": ["complex", "advanced", "detailed", "deep", "sophisticated"],
                    "rag": ["search", "retrieve", "document", "knowledge", "lookup"],
                    "agent": ["tool", "execute", "action", "api", "compute"]
                },
                "confidence_adjustments": {
                    "reassignment_penalty": 0.2,
                    "fallback_boost": 0.1,
                    "memory_boost": 0.15
                },
                "memory_support": {
                    "langflow_chat_memory": self.support_memory_routing,
                    "custom_memory": self.support_memory_routing,
                    "boost_factor": 0.1
                },
                "langchainjs_compatibility": {
                    "export_format": self.langchainjs_export,
                    "flatten_metadata": self.flatten_metadata,
                    "runnable_interface": self.enable_runnable_interface,
                    "async_support": True,
                    "streaming_support": True
                },
                "lcel_configuration": {
                    "enable_runnable": self.enable_runnable_interface,
                    "enable_passthrough": True,
                    "enable_lambda": True,
                    "enable_parallel": True
                }
            }
            
            try:
                if self.vercel_mode:
                    config_str = os.getenv("LANGFLOW_CONDITIONAL_ROUTER_CONFIG", "{}")
                    vercel_config = json.loads(config_str) if config_str else {}
                    default_config.update(vercel_config)
                    
                    # Vercel特定配置
                    default_config["deployment"] = {
                        "env": "vercel",
                        "edge_compatible": True,
                        "region": os.getenv("VERCEL_REGION", "unknown"),
                        "function_timeout": int(os.getenv("VERCEL_FUNCTION_TIMEOUT", "30"))
                    }
                else:
                    config_str = os.getenv("CONDITIONAL_ROUTER_CONFIG", "{}")
                    env_config = json.loads(config_str) if config_str else {}
                    default_config.update(env_config)
                    
            except (json.JSONDecodeError, TypeError):
                pass
                
            return default_config
    
        def extract_routing_info(self, message: Message) -> Dict[str, Any]:
            """提取路由信息，兼容多种metadata格式和ChatMemory"""
            
            routing_info = {
                "route": "basic",
                "confidence": 0.5,
                "metadata_available": False,
                "text_route": None,
                "lcel_compatible": False,
                "reassignment_info": {},
                "memory_info": {},
                "langchainjs_format": False,
                "memory_format": "none"
            }
            
            try:
                if not message:
                    return routing_info
                
                # 从消息文本提取（简化格式：直接是路由名称）
                if hasattr(message, 'text') and message.text:
                    text = message.text.strip().lower()
                    if text in ["basic", "enhanced", "rag", "agent"]:
                        routing_info["text_route"] = text
                
                # 从metadata提取详细信息
                if hasattr(message, 'metadata') and message.metadata:
                    metadata = message.metadata
                    routing_info["metadata_available"] = True
                    
                    # 检测格式类型
                    routing_info["langchainjs_format"] = (
                        metadata.get('langchainjs_ready', False) or 
                        metadata.get('runnable_interface', False)
                    )
                    routing_info["lcel_compatible"] = metadata.get('lcel_compatible', False)
                    routing_info["memory_format"] = metadata.get('memory_format', 'none')
                    
                    # 提取路由决策（支持多种字段名）
                    route_keys = ['routing_decision', 'route', 'routing_hint']
                    for key in route_keys:
                        if key in metadata and metadata[key]:
                            routing_info["route"] = str(metadata[key]).lower()
                            break
                    
                    # 提取置信度
                    if 'confidence' in metadata:
                        try:
                            routing_info["confidence"] = float(metadata['confidence'])
                        except:
                            routing_info["confidence"] = 0.5
                    
                    # 提取重指派信息
                    if self.support_reassignment:
                        if self.flatten_metadata:
                            # 扁平化格式
                            routing_info["reassignment_info"] = {
                                "required": metadata.get('reassignment_required', False),
                                "reason": metadata.get('reassignment_reason', []),
                                "attempt_count": metadata.get('reassignment_attempt_count', 0),
                                "original_route": metadata.get('reassignment_original_route')
                            }
                        else:
                            # 嵌套格式
                            routing_info["reassignment_info"] = metadata.get('reassignment', {})
                    
                    # 提取记忆信息
                    if self.support_memory_routing:
                        if self.flatten_metadata:
                            routing_info["memory_info"] = {
                                "has_memory": metadata.get('has_memory', False),
                                "conversation_history": metadata.get('conversation_history', ''),
                                "memory_length": metadata.get('memory_length', 0),
                                "memory_format": metadata.get('memory_format', 'none'),
                                "conversation_rounds": metadata.get('conversation_rounds', 0)
                            }
                        else:
                            routing_info["memory_info"] = metadata.get('memory', {})
                    
                    # 其他信息
                    routing_info["analysis_method"] = metadata.get('analysis_method', 'unknown')
                    routing_info["component_source"] = metadata.get('component_source', 'unknown')
            
            except Exception as e:
                self.status = f"⚠️ Info extraction error: {str(e)[:25]}..."
            
            return routing_info
    
        def evaluate_route_match(self, routing_info: Dict[str, Any], target_route: str, 
                                env_config: Dict[str, Any]) -> tuple[bool, str, float]:
            """评估路由匹配，支持多种策略和环境配置"""
            
            detected_route = routing_info["route"]
            confidence = routing_info["confidence"]
            text_route = routing_info.get("text_route")
            reassignment_info = routing_info.get("reassignment_info", {})
            memory_info = routing_info.get("memory_info", {})
            
            threshold = float(self.confidence_threshold)
            
            match_result = False
            match_reason = "no_match"
            effective_confidence = confidence
            
            # 不区分大小写处理
            if not self.case_sensitive:
                target_route = target_route.lower()
                detected_route = detected_route.lower()
                if text_route:
                    text_route = text_route.lower()
            
            # 获取置信度调整配置
            confidence_adjustments = env_config.get("confidence_adjustments", {})
            memory_support = env_config.get("memory_support", {})
            
            # 置信度调整逻辑
            if reassignment_info.get("required", False):
                penalty = confidence_adjustments.get("reassignment_penalty", 0.2)
                effective_confidence = max(0.1, confidence - penalty)
            
            if memory_info.get("has_memory", False) and self.support_memory_routing:
                boost = memory_support.get("boost_factor", 0.15)
                effective_confidence = min(1.0, effective_confidence + boost)
            
            # 根据匹配策略执行评估
            if self.matching_strategy == "exact_match":
                match_result = detected_route == target_route
                match_reason = "exact_match" if match_result else "exact_no_match"
                
            elif self.matching_strategy == "metadata_priority":
                if routing_info["metadata_available"]:
                    match_result = detected_route == target_route
                    match_reason = "metadata_match" if match_result else "metadata_no_match"
                elif text_route:
                    match_result = text_route == target_route
                    match_reason = "text_fallback_match" if match_result else "text_fallback_no_match"
                    
            elif self.matching_strategy == "confidence_aware":
                if effective_confidence >= threshold:
                    match_result = detected_route == target_route
                    match_reason = "confidence_sufficient_match" if match_result else "confidence_sufficient_no_match"
                else:
                    match_result = False
                    match_reason = "confidence_insufficient"
                    
            elif self.matching_strategy == "langchainjs_compatible":
                # LangChain.js兼容模式
                if routing_info.get("langchainjs_format", False):
                    match_result = detected_route == target_route
                    match_reason = "langchainjs_match" if match_result else "langchainjs_no_match"
                else:
                    # 回退到智能匹配
                    match_result, match_reason, effective_confidence = self._smart_flexible_matching(
                        detected_route, target_route, text_route, effective_confidence, threshold, env_config
                    )
                    
            else:  # smart_flexible
                match_result, match_reason, effective_confidence = self._smart_flexible_matching(
                    detected_route, target_route, text_route, effective_confidence, threshold, env_config
                )
            
            return match_result, match_reason, effective_confidence
    
        def _smart_flexible_matching(self, detected_route: str, target_route: str, text_route: str,
                                    effective_confidence: float, threshold: float, env_config: Dict) -> tuple[bool, str, float]:
            """智能灵活匹配逻辑"""
            # 1. 首先尝试精确匹配
            if detected_route == target_route:
                return True, "smart_exact_match", effective_confidence
            
            # 2. 文本路由匹配（如果可用）
            if text_route and text_route == target_route:
                boosted_confidence = min(1.0, effective_confidence + 0.1)
                return True, "smart_text_match", boosted_confidence
            
            # 3. 后备匹配（如果启用）
            if self.enable_fallback_matching:
                if self._check_fallback_matching(detected_route, target_route, env_config):
                    fallback_confidence = max(effective_confidence - 0.1, 0.4)
                    return True, "smart_fallback_match", fallback_confidence
            
            # 4. 置信度检查
            if effective_confidence < (threshold - 0.1):
                return False, "smart_low_confidence_block", effective_confidence
            
            return False, "smart_no_match", effective_confidence
    
        def _check_fallback_matching(self, detected_route: str, target_route: str, env_config: Dict) -> bool:
            """检查后备匹配规则"""
            route_similarities = env_config.get("route_similarities", {
                "basic": ["simple", "easy", "quick"],
                "enhanced": ["complex", "advanced", "detailed", "deep"],
                "rag": ["search", "retrieve", "document", "knowledge"],
                "agent": ["tool", "execute", "action", "api"]
            })
            
            similar_list = route_similarities.get(target_route, [])
            return detected_route in similar_list
    
        # LCEL Runnable接口实现
        def invoke(self, input_data: Any, config: Optional[Dict] = None) -> Message:
            """LCEL Runnable.invoke方法实现"""
            # 临时设置输入数据
            original_input = getattr(self, 'routing_message', None)
            self.routing_message = input_data if isinstance(input_data, Message) else Message(text=str(input_data))
            
            try:
                # 尝试匹配路由
                env_config = self._load_environment_config()
                routing_info = self.extract_routing_info(self.routing_message)
                match_result, match_reason, effective_confidence = self.evaluate_route_match(routing_info, self.match_route, env_config)
                
                if match_result:
                    return self._enhance_message_metadata(
                        self.routing_message, 
                        match_reason, 
                        effective_confidence,
                        routing_info,
                        env_config
                    )
                else:
                    # 返回带有阻塞标记的消息
                    blocked_message = self._enhance_message_metadata(
                        self.routing_message,
                        f"blocked_{match_reason}",
                        effective_confidence,
                        routing_info,
                        env_config
                    )
                    blocked_message.metadata["blocked"] = True
                    return blocked_message
            finally:
                # 恢复原始输入
                self.routing_message = original_input
    
        async def ainvoke(self, input_data: Any, config: Optional[Dict] = None) -> Message:
            """LCEL Runnable.ainvoke异步方法实现"""
            return self.invoke(input_data, config)
    
        def stream(self, input_data: Any, config: Optional[Dict] = None):
            """LCEL Runnable.stream方法实现"""
            result = self.invoke(input_data, config)
            yield result
    
        async def astream(self, input_data: Any, config: Optional[Dict] = None):
            """LCEL Runnable.astream异步流方法实现"""
            result = await self.ainvoke(input_data, config)
            yield result
    
        def batch(self, inputs: List[Any], config: Optional[Dict] = None) -> List[Message]:
            """LCEL Runnable.batch方法实现"""
            return [self.invoke(input_data, config) for input_data in inputs]
    
        async def abatch(self, inputs: List[Any], config: Optional[Dict] = None) -> List[Message]:
            """LCEL Runnable.abatch异步批处理方法实现"""
            return [await self.ainvoke(input_data, config) for input_data in inputs]
    
        def get_route_match(self) -> Message:
            """路由匹配时返回原消息，否则停止此输出"""
            
            if not self.routing_message:
                self.stop("route_match")
                return
            
            # 加载环境配置
            env_config = self._load_environment_config()
            
            # 提取路由信息
            routing_info = self.extract_routing_info(self.routing_message)
            
            # 评估匹配
            match_result, match_reason, effective_confidence = self.evaluate_route_match(routing_info, self.match_route, env_config)
            
            if match_result:
                # 匹配成功，传递消息
                enhanced_message = self._enhance_message_metadata(
                    self.routing_message, 
                    match_reason, 
                    effective_confidence,
                    routing_info,
                    env_config
                )
                
                # 状态指示器
                memory_indicator = "💬" if routing_info.get("memory_format") == "langflow_chat_memory" else ("📝" if routing_info.get("memory_info", {}).get("has_memory") else "")
                reassign_indicator = "🔄" if routing_info.get("reassignment_info", {}).get("required", False) else ""
                
                self.status = f"✅ Match: {self.match_route.upper()} ({effective_confidence:.2f}) - {match_reason} {memory_indicator}{reassign_indicator}"
                return enhanced_message
            else:
                # 不匹配，停止此输出路径
                self.stop("route_match")
                self.status = f"🚫 Block: {self.match_route.upper()} - {match_reason}"
    
        def get_route_block(self) -> Message:
            """路由不匹配时返回原消息，匹配时停止此输出"""
            
            if not self.routing_message:
                self.stop("route_block")
                return
            
            # 加载环境配置
            env_config = self._load_environment_config()
            
            routing_info = self.extract_routing_info(self.routing_message)
            match_result, match_reason, effective_confidence = self.evaluate_route_match(routing_info, self.match_route, env_config)
            
            if not match_result:
                # 不匹配，允许通过
                enhanced_message = self._enhance_message_metadata(
                    self.routing_message,
                    f"block_passthrough_{match_reason}",
                    effective_confidence,
                    routing_info,
                    env_config
                )
                
                self.status = f"🔄 Block Pass: {self.match_route.upper()} - {match_reason}"
                return enhanced_message
            else:
                # 匹配，停止此输出路径
                self.stop("route_block")
                self.status = f"🛑 Block Stop: {self.match_route.upper()} - matched"
    
        def _enhance_message_metadata(self, message: Message, match_reason: str, confidence: float, 
                                     routing_info: Dict[str, Any], env_config: Dict[str, Any]) -> Message:
            """增强消息metadata，保持LCEL兼容性"""
            try:
                if not hasattr(message, 'metadata'):
                    message.metadata = {}
                
                # 根据模式选择metadata格式
                if self.langchainjs_export:
                    # LangChain.js兼容格式（扁平化）
                    message.metadata.update({
                        "conditional_router_component": "OptimizedEnhancedConditionalRouter",
                        "target_route": self.match_route,
                        "match_reason": match_reason,
                        "effective_confidence": confidence,
                        "matching_strategy": self.matching_strategy,
                        "passed_through": True,
                        "route_chain_step": f"conditional_{self.match_route}",
                        "lcel_compatible": True,
                        "langchainjs_ready": True,
                        "runnable_interface": self.enable_runnable_interface,
                        "runnable_type": "conditional_router",
                        "supports_streaming": True,
                        "supports_async": True,
                        "vercel_mode": self.vercel_mode,
                        "flatten_metadata": self.flatten_metadata,
                        "support_memory_routing": self.support_memory_routing,
                        "timestamp": datetime.now().isoformat()
                    })
                elif self.flatten_metadata:
                    # 扁平化格式
                    message.metadata.update({
                        "conditional_router_component": "OptimizedEnhancedConditionalRouter",
                        "conditional_target_route": self.match_route,
                        "conditional_match_reason": match_reason,
                        "conditional_effective_confidence": confidence,
                        "conditional_matching_strategy": self.matching_strategy,
                        "conditional_passed_through": True,
                        "route_chain_step": f"conditional_{self.match_route}",
                        "lcel_compatible": routing_info.get("lcel_compatible", True),
                        "runnable_interface": self.enable_runnable_interface
                    })
                else:
                    # 嵌套格式
                    message.metadata.update({
                        "conditional_routing": {
                            "component": "OptimizedEnhancedConditionalRouter",
                            "target_route": self.match_route,
                            "match_reason": match_reason,
                            "effective_confidence": confidence,
                            "matching_strategy": self.matching_strategy,
                            "passed_through": True,
                            "env_config": env_config.get("matching_strategies", {}).get(self.matching_strategy, {}),
                            "lcel_compatible": self.enable_runnable_interface,
                            "memory_support": self.support_memory_routing
                        },
                        "route_chain_step": f"conditional_{self.match_route}",
                        "lcel_compatible": routing_info.get("lcel_compatible", True)
                    })
                
                return message
                
            except Exception as e:
                # 如果metadata增强失败，返回原消息
                self.status = f"⚠️ Metadata enhance failed: {str(e)[:20]}..."
                return message
    
        def update_build_config(self, build_config: dict, field_value: str, field_name: str | None = None) -> dict:
            """动态更新配置"""
            if field_name == "matching_strategy":
                if field_value == "confidence_aware":
                    # 显示置信度阈值设置
                    build_config["confidence_threshold"] = {"show": True, "advanced": True}
                elif field_value == "smart_flexible":
                    # 显示后备匹配设置
                    build_config["enable_fallback_matching"] = {"show": True, "advanced": True}
                elif field_value == "langchainjs_compatible":
                    # 显示LangChain.js相关设置
                    build_config["langchainjs_export"] = {"show": True, "advanced": False}
                    build_config["flatten_metadata"] = {"show": True, "advanced": False}
                    build_config["enable_runnable_interface"] = {"show": True, "advanced": False}
            
            elif field_name == "langchainjs_export":
                if field_value:
                    build_config["enable_runnable_interface"]["show"] = True
                    build_config["flatten_metadata"]["show"] = True
                    build_config["support_memory_routing"]["show"] = True
                else:
                    build_config["enable_runnable_interface"]["show"] = False
                    
            elif field_name == "vercel_mode":
                if field_value:
                    build_config["enable_runnable_interface"]["value"] = True
                    build_config["flatten_metadata"]["value"] = True
                    
            return build_config
    
        # LCEL Chain组合方法
        def pipe(self, *others):
            """LCEL pipe操作符支持"""
            from langchain_core.runnables import RunnableSequence
            return RunnableSequence(first=self, middle=[], last=others[0] if others else RunnablePassthrough())
        
        def __or__(self, other):
            """LCEL | 操作符支持"""
            return self.pipe(other)
            
        def __ror__(self, other):
            """LCEL | 操作符支持（反向）"""
            if hasattr(other, 'pipe'):
                return other.pipe(self)
            from langchain_core.runnables import RunnableSequence
            return RunnableSequence(first=other, middle=[], last=self)
    
        @property
        def config_specs(self):
            """LCEL配置规范"""
            return {
                "runnable_type": "conditional_router",
                "supports_streaming": True,
                "supports_async": True,
                "supports_batching": True,
                "memory_compatible": self.support_memory_routing,
                "langchainjs_exportable": True
            }
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



​    