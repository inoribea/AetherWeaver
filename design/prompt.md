    from __future__ import annotations
    
    import os
    import json
    from typing import Any, Dict, List, Union, Optional
    from datetime import datetime
    
    from langchain_core.runnables import Runnable, RunnableLambda, RunnablePassthrough
    
    from langflow.custom.custom_component.component import Component
    from langflow.io import MessageInput, Output, MultilineInput, StrInput, BoolInput, DropdownInput
    from langflow.schema.message import Message
    
    class AgentPromptComponent(Component, Runnable):
        display_name = "Agent Prompt (LCEL/LangChain.js Compatible)"
        description = "LCEL-compatible agent prompt with memory, tools, document context support and LangChain.js export"
        icon = "cpu"
        name = "AgentPromptComponent"
    
        inputs = [
            MessageInput(
                name="input",
                display_name="User Input",
                info="User's input message (supports routing metadata)",
                required=True,
            ),
            MessageInput(
                name="memory",
                display_name="Memory",
                info="Chat history from LangFlow ChatMemory or custom memory component",
                required=False,
            ),
            MessageInput(
                name="tools_results",
                display_name="Tools Results",
                info="Results from tool execution",
                required=False,
            ),
            MessageInput(
                name="context_documents",
                display_name="Context Documents",
                info="Retrieved documents from vector store",
                required=False,
            ),
            # 新增路由上下文输入
            MessageInput(
                name="routing_context",
                display_name="Routing Context",
                info="Routing information from SmartRouting component",
                required=False,
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
                info="Enable LangChain.js compatible configuration and export",
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
                name="adaptive_prompt_generation",
                display_name="Adaptive Prompt Generation",
                value=True,
                info="Dynamically adapt prompt based on routing context",
                advanced=False,
            ),
            BoolInput(
                name="memory_integration",
                display_name="Memory Integration",
                value=True,
                info="Automatically integrate with LangFlow ChatMemory format",
                advanced=False,
            ),
            DropdownInput(
                name="prompt_mode",
                display_name="Prompt Mode",
                options=["adaptive", "basic", "enhanced", "rag", "agent"],
                value="adaptive",
                info="Prompt generation mode",
                real_time_refresh=True,
            ),
            MultilineInput(
                name="system_template",
                display_name="System Template",
                info="Base agent system message template (will be enhanced with routing and memory)",
                value="""你是一个智能AI代理，可以使用工具和知识库来帮助用户。
    
    对话历史:
    {memory}
    
    工具执行结果:
    {tools_results}
    
    知识库文档:
    {context_documents}
    
    工作指南：
    1. 仔细分析用户请求
    2. 如有工具结果，优先基于工具结果回答
    3. 结合知识库文档提供补充信息
    4. 如果工具和文档都无法满足需求，基于你的知识回答
    5. 提供准确、有用、完整的解答
    
    用户请求：{input}""",
                advanced=False,
            ),
            BoolInput(
                name="prioritize_tools",
                display_name="Prioritize Tools",
                info="Prioritize tool results over documents",
                value=True,
                advanced=True,
            ),
            BoolInput(
                name="include_routing_context",
                display_name="Include Routing Context",
                info="Include routing analysis in prompt",
                value=True,
                advanced=True,
            ),
            BoolInput(
                name="chinese_prompt_optimization",
                display_name="Chinese Prompt Optimization",
                info="Optimize prompts for Chinese language processing",
                value=True,
                advanced=True,
            ),
        ]
    
        outputs = [
            Output(
                display_name="LCEL Prompt Output",
                name="lcel_prompt_output",
                method="build_lcel_agent_prompt",
            ),
        ]
    
        def _load_environment_config(self) -> Dict[str, Any]:
            """加载环境变量配置，支持Vercel模式"""
            
            default_config = {
                "prompt_templates": {
                    "adaptive": {
                        "basic": "简洁友好的对话助手模式",
                        "enhanced": "深度分析和专业建议模式", 
                        "rag": "基于知识库的准确回答模式",
                        "agent": "工具调用和任务执行模式"
                    },
                    "memory_integration": self.memory_integration,
                    "routing_integration": self.include_routing_context
                },
                "language_support": {
                    "chinese_optimization": self.chinese_prompt_optimization,
                    "auto_language_detection": True,
                    "bilingual_support": True
                },
                "lcel_configuration": {
                    "enable_runnable": self.enable_runnable_interface,
                    "enable_streaming": True,
                    "enable_async": True,
                    "enable_batching": True
                },
                "langchainjs_compatibility": {
                    "export_format": self.langchainjs_export,
                    "flatten_metadata": self.flatten_metadata,
                    "runnable_interface": self.enable_runnable_interface,
                    "memory_compatible": True
                },
                "memory_formats": {
                    "langflow_chat_memory": True,
                    "custom_memory": True,
                    "conversation_markers": ["Human:", "Assistant:", "User:", "AI:", "System:"]
                }
            }
            
            try:
                if self.vercel_mode:
                    config_str = os.getenv("LANGFLOW_AGENT_PROMPT_CONFIG", "{}")
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
                    config_str = os.getenv("AGENT_PROMPT_CONFIG", "{}")
                    env_config = json.loads(config_str) if config_str else {}
                    default_config.update(env_config)
                    
            except (json.JSONDecodeError, TypeError):
                pass
                
            return default_config
    
        def extract_routing_context(self, routing_context: Optional[Message] = None) -> Dict[str, Any]:
            """提取路由上下文信息，兼容SmartRouting输出"""
            
            context_info = {
                "route": "basic",
                "confidence": 0.7,
                "language": "auto",
                "is_chinese": False,
                "analysis_method": "unknown",
                "has_memory": False,
                "memory_format": "none",
                "conversation_history": "",
                "original_text": "",
                "metadata": {}
            }
            
            try:
                if not routing_context:
                    return context_info
                
                # 从routing_context的metadata提取路由信息
                if hasattr(routing_context, 'metadata') and routing_context.metadata:
                    metadata = routing_context.metadata
                    context_info["metadata"] = metadata
                    
                    # 支持扁平化和嵌套格式
                    if self.flatten_metadata:
                        # 扁平化格式
                        context_info.update({
                            "route": metadata.get('routing_decision') or metadata.get('route', 'basic'),
                            "confidence": metadata.get('confidence', 0.7),
                            "analysis_method": metadata.get('analysis_method', 'unknown'),
                            "has_memory": metadata.get('has_memory', False),
                            "memory_format": metadata.get('memory_format', 'none'),
                            "conversation_history": metadata.get('conversation_history', ''),
                            "original_text": metadata.get('original_user_input', ''),
                            "is_chinese": self._detect_chinese(metadata.get('original_user_input', ''))
                        })
                    else:
                        # 嵌套格式
                        memory_info = metadata.get('memory', {})
                        context_info.update({
                            "route": metadata.get('routing_decision') or metadata.get('route', 'basic'),
                            "confidence": metadata.get('confidence', 0.7),
                            "analysis_method": metadata.get('analysis_method', 'unknown'),
                            "has_memory": memory_info.get('has_memory', False),
                            "memory_format": memory_info.get('memory_format', 'none'),
                            "conversation_history": memory_info.get('conversation_history', ''),
                            "original_text": metadata.get('original_user_input', ''),
                            "is_chinese": self._detect_chinese(metadata.get('original_user_input', ''))
                        })
                
                # 从routing_context的文本提取信息
                if hasattr(routing_context, 'text') and routing_context.text:
                    if not context_info["original_text"]:
                        context_info["original_text"] = routing_context.text
                        context_info["is_chinese"] = self._detect_chinese(routing_context.text)
                
                # 设置语言
                context_info["language"] = "zh" if context_info["is_chinese"] else "en"
                
            except Exception as e:
                self.status = f"⚠️ Routing context extraction error: {str(e)[:30]}..."
            
            return context_info
    
        def _detect_chinese(self, text: str) -> bool:
            """检测文本是否包含中文"""
            if not text:
                return False
            
            chinese_chars = sum(1 for char in text if '\u4e00' <= char <= '\u9fff')
            return chinese_chars > len(text) * 0.3
    
        def extract_memory_content(self, memory: Optional[Message] = None) -> Dict[str, Any]:
            """提取记忆内容，兼容LangFlow ChatMemory格式"""
            
            memory_info = {
                "content": "",
                "has_content": False,
                "format": "none",
                "conversation_rounds": 0,
                "latest_exchange": [],
                "processed_history": ""
            }
            
            try:
                if not memory:
                    return memory_info
                
                # 获取记忆文本
                memory_text = ""
                if hasattr(memory, 'text') and memory.text:
                    memory_text = str(memory.text)
                elif hasattr(memory, 'content'):
                    memory_text = str(memory.content)
                else:
                    memory_text = str(memory)
                
                if not memory_text.strip():
                    return memory_info
                
                memory_info["content"] = memory_text
                memory_info["has_content"] = True
                
                # 检测记忆格式
                if self._is_langflow_chat_memory(memory_text):
                    memory_info["format"] = "langflow_chat_memory"
                    memory_info.update(self._parse_langflow_chat_memory(memory_text))
                elif self._is_structured_memory(memory_text):
                    memory_info["format"] = "structured_memory"
                    memory_info.update(self._parse_structured_memory(memory_text))
                else:
                    memory_info["format"] = "plain_text"
                    memory_info["processed_history"] = memory_text
                
            except Exception as e:
                self.status = f"⚠️ Memory extraction error: {str(e)[:30]}..."
            
            return memory_info
    
        def _is_langflow_chat_memory(self, text: str) -> bool:
            """检测是否为LangFlow ChatMemory格式"""
            indicators = ["Human:", "Assistant:", "User:", "AI:"]
            return any(indicator in text for indicator in indicators)
    
        def _parse_langflow_chat_memory(self, text: str) -> Dict[str, Any]:
            """解析LangFlow ChatMemory格式"""
            lines = text.split('\n')
            conversations = []
            current_speaker = None
            current_content = []
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                # 检测对话标记
                if line.startswith(('Human:', 'User:')):
                    if current_speaker and current_content:
                        conversations.append({
                            "speaker": current_speaker,
                            "content": ' '.join(current_content)
                        })
                    current_speaker = "user"
                    current_content = [line.split(':', 1)[1].strip()]
                elif line.startswith(('Assistant:', 'AI:')):
                    if current_speaker and current_content:
                        conversations.append({
                            "speaker": current_speaker,
                            "content": ' '.join(current_content)
                        })
                    current_speaker = "assistant"
                    current_content = [line.split(':', 1)[1].strip()]
                else:
                    if current_content:
                        current_content.append(line)
            
            # 添加最后一个对话
            if current_speaker and current_content:
                conversations.append({
                    "speaker": current_speaker,
                    "content": ' '.join(current_content)
                })
            
            # 提取最近的对话交换
            latest_exchange = conversations[-4:] if len(conversations) >= 4 else conversations
            
            # 生成处理后的历史记录
            processed_lines = []
            for conv in conversations:
                speaker_label = "用户" if conv["speaker"] == "user" else "助手"
                processed_lines.append(f"{speaker_label}: {conv['content']}")
            
            return {
                "conversation_rounds": len([c for c in conversations if c["speaker"] == "user"]),
                "latest_exchange": latest_exchange,
                "processed_history": '\n'.join(processed_lines)
            }
    
        def _is_structured_memory(self, text: str) -> bool:
            """检测是否为结构化记忆格式"""
            return '\n' in text and any(marker in text for marker in ["对话", "历史", "记录"])
    
        def _parse_structured_memory(self, text: str) -> Dict[str, Any]:
            """解析结构化记忆格式"""
            lines = text.split('\n')
            processed_lines = [line.strip() for line in lines if line.strip()]
            
            return {
                "conversation_rounds": len(processed_lines) // 2,  # 估算对话轮次
                "latest_exchange": processed_lines[-4:] if len(processed_lines) >= 4 else processed_lines,
                "processed_history": '\n'.join(processed_lines)
            }
    
        def extract_tools_results(self, tools_results: Optional[Message] = None) -> Dict[str, Any]:
            """提取工具执行结果"""
            
            tools_info = {
                "content": "",
                "has_results": False,
                "results_count": 0,
                "processed_results": ""
            }
            
            try:
                if not tools_results:
                    return tools_info
                
                # 获取工具结果文本
                if hasattr(tools_results, 'text') and tools_results.text:
                    content = str(tools_results.text)
                else:
                    content = str(tools_results)
                
                if content.strip():
                    tools_info["content"] = content
                    tools_info["has_results"] = True
                    tools_info["results_count"] = len(content.split('\n'))
                    tools_info["processed_results"] = content
                
            except Exception as e:
                self.status = f"⚠️ Tools results extraction error: {str(e)[:30]}..."
            
            return tools_info
    
        def extract_context_documents(self, context_documents: Optional[Message] = None) -> Dict[str, Any]:
            """提取上下文文档"""
            
            docs_info = {
                "content": "",
                "has_documents": False,
                "documents_count": 0,
                "processed_documents": ""
            }
            
            try:
                if not context_documents:
                    return docs_info
                
                # 获取文档文本
                if hasattr(context_documents, 'text') and context_documents.text:
                    content = str(context_documents.text)
                elif hasattr(context_documents, 'data'):
                    # 处理结构化文档数据
                    data = context_documents.data
                    if isinstance(data, list):
                        doc_texts = []
                        for doc in data:
                            if hasattr(doc, 'page_content'):
                                doc_texts.append(doc.page_content)
                            elif hasattr(doc, 'text'):
                                doc_texts.append(doc.text)
                            else:
                                doc_texts.append(str(doc))
                        content = '\n\n'.join(doc_texts)
                    else:
                        content = str(data)
                else:
                    content = str(context_documents)
                
                if content.strip():
                    docs_info["content"] = content
                    docs_info["has_documents"] = True
                    docs_info["documents_count"] = len(content.split('\n\n'))
                    docs_info["processed_documents"] = content
                
            except Exception as e:
                self.status = f"⚠️ Documents extraction error: {str(e)[:30]}..."
            
            return docs_info
    
        def generate_adaptive_prompt(self, routing_context: Dict[str, Any], 
                                    env_config: Dict[str, Any]) -> str:
            """生成自适应提示词，基于路由上下文"""
            
            route = routing_context["route"]
            is_chinese = routing_context["is_chinese"]
            confidence = routing_context["confidence"]
            
            # 获取基础模板
            base_template = self.system_template
            
            # 根据路由类型调整提示词
            if route == "basic":
                if is_chinese:
                    mode_instruction = """
    当前模式：基础对话模式
    - 提供简洁、直接、友好的回答
    - 使用自然、易懂的语言
    - 避免过于技术性的内容
    - 保持对话的轻松氛围"""
                else:
                    mode_instruction = """
    Current Mode: Basic Conversation Mode
    - Provide concise, direct, and friendly responses
    - Use natural, easy-to-understand language
    - Avoid overly technical content
    - Maintain a relaxed conversational atmosphere"""
                    
            elif route == "enhanced":
                if is_chinese:
                    mode_instruction = """
    当前模式：增强分析模式
    - 提供深入、专业、详细的分析
    - 考虑多个角度和层面
    - 提供具体的建议和解决方案
    - 展现专业知识和洞察力
    - 结构化组织回答内容"""
                else:
                    mode_instruction = """
    Current Mode: Enhanced Analysis Mode
    - Provide in-depth, professional, detailed analysis
    - Consider multiple angles and dimensions
    - Offer specific recommendations and solutions
    - Demonstrate professional knowledge and insights
    - Structure responses in an organized manner"""
                    
            elif route == "rag":
                if is_chinese:
                    mode_instruction = """
    当前模式：知识检索模式
    - 基于提供的参考文档和知识库回答
    - 确保信息的准确性和可靠性
    - 明确引用相关文档内容
    - 如果文档不足，明确说明信息来源
    - 优先使用已验证的知识"""
                else:
                    mode_instruction = """
    Current Mode: Knowledge Retrieval Mode
    - Answer based on provided reference documents and knowledge base
    - Ensure accuracy and reliability of information
    - Clearly reference relevant document content
    - If documents are insufficient, clearly indicate information sources
    - Prioritize verified knowledge"""
                    
            elif route == "agent":
                if is_chinese:
                    mode_instruction = """
    当前模式：工具执行模式
    - 可以使用提供的工具来完成任务
    - 根据用户需求选择合适的工具
    - 基于工具执行结果提供答案
    - 解释工具使用的过程和结果
    - 确保任务的完整执行"""
                else:
                    mode_instruction = """
    Current Mode: Tool Execution Mode
    - Can use provided tools to complete tasks
    - Choose appropriate tools based on user needs
    - Provide answers based on tool execution results
    - Explain the process and results of tool usage
    - Ensure complete task execution"""
            
            # 组合最终提示词
            adaptive_template = f"""{base_template}
    
    {mode_instruction}
    
    当前分析置信度: {confidence:.2f}
    路由分析方法: {routing_context.get('analysis_method', 'unknown')}
    """
            
            return adaptive_template
    
        # LCEL Runnable接口实现
        def invoke(self, input_data: Any, config: Optional[Dict] = None) -> Message:
            """LCEL Runnable.invoke方法实现"""
            # 临时设置输入数据
            original_input = getattr(self, 'input', None)
            self.input = input_data if isinstance(input_data, Message) else Message(text=str(input_data))
            
            try:
                result = self.build_lcel_agent_prompt()
                return result
            finally:
                # 恢复原始输入
                self.input = original_input
    
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
    
        def build_lcel_agent_prompt(self) -> Message:
            """构建LCEL兼容的Agent提示词"""
            try:
                # 加载环境配置
                env_config = self._load_environment_config()
                
                # 提取所有输入内容
                user_input = self.input.text if hasattr(self.input, 'text') else str(self.input)
                
                # 提取路由上下文
                routing_context = self.extract_routing_context(getattr(self, 'routing_context', None))
                
                # 提取记忆内容
                memory_info = self.extract_memory_content(getattr(self, 'memory', None))
                
                # 提取工具结果
                tools_info = self.extract_tools_results(getattr(self, 'tools_results', None))
                
                # 提取文档上下文
                docs_info = self.extract_context_documents(getattr(self, 'context_documents', None))
                
                # 生成提示词模板
                if self.adaptive_prompt_generation and self.prompt_mode == "adaptive":
                    template = self.generate_adaptive_prompt(routing_context, env_config)
                else:
                    # 使用固定模式的模板
                    template = self.system_template
                
                # 根据优先级调整内容顺序
                if self.prioritize_tools and tools_info["has_results"]:
                    template = template.replace(
                        "如有工具结果，优先基于工具结果回答",
                        "**优先使用工具执行结果**，然后结合其他信息"
                    )
                
                # 格式化提示词
                formatted_prompt = template.format(
                    input=user_input,
                    memory=memory_info["processed_history"] if memory_info["has_content"] else "无历史对话",
                    tools_results=tools_info["processed_results"] if tools_info["has_results"] else "无工具执行结果",
                    context_documents=docs_info["processed_documents"] if docs_info["has_documents"] else "无相关文档"
                )
                
                # 如果包含路由上下文，添加路由信息
                if self.include_routing_context and routing_context["route"] != "basic":
                    route_info = f"""
    
    📍 路由分析信息:
    - 处理模式: {routing_context['route'].upper()}
    - 分析置信度: {routing_context['confidence']:.2f}
    - 语言: {'中文' if routing_context['is_chinese'] else 'English'}
    - 分析方法: {routing_context['analysis_method']}"""
    
                    formatted_prompt += route_info
                
                # 构建输出metadata
                metadata = self._create_prompt_metadata(
                    routing_context, memory_info, tools_info, docs_info, 
                    user_input, formatted_prompt, env_config
                )
                
                # 生成状态指示器
                route_indicator = f"🎯{routing_context['route'].upper()}" if routing_context['route'] != 'basic' else ""
                memory_indicator = "💬" if memory_info["format"] == "langflow_chat_memory" else ("📝" if memory_info["has_content"] else "🆕")
                tool_indicator = "🔧" if tools_info["has_results"] else ""
                doc_indicator = "📚" if docs_info["has_documents"] else ""
                
                self.status = f"✅ Prompt: {len(formatted_prompt)} 字符 {route_indicator}{memory_indicator}{tool_indicator}{doc_indicator}"
                
                return Message(text=formatted_prompt, metadata=metadata)
                
            except Exception as e:
                error_msg = f"Agent提示词构建失败: {str(e)}"
                self.status = f"❌ {error_msg[:50]}..."
                
                return Message(
                    text="Agent提示词构建过程中出现错误，使用基础模式。",
                    metadata={
                        "error": error_msg, 
                        "component_source": "AgentPromptComponent",
                        "fallback_mode": True
                    }
                )
    
        def _create_prompt_metadata(self, routing_context: Dict, memory_info: Dict, 
                                   tools_info: Dict, docs_info: Dict, user_input: str, 
                                   formatted_prompt: str, env_config: Dict) -> Dict[str, Any]:
            """创建提示词metadata，支持LCEL和LangChain.js兼容性"""
            
            if self.langchainjs_export:
                # LangChain.js兼容格式（扁平化）
                return {
                    # LangChain.js核心字段
                    "type": "agent_prompt",
                    "source": "langflow",
                    "component": "AgentPromptComponent",
                    "version": "1.0",
                    "timestamp": datetime.now().isoformat(),
                    
                    # 提示词信息
                    "prompt_type": "agent",
                    "prompt_mode": self.prompt_mode,
                    "adaptive_generation": self.adaptive_prompt_generation,
                    "template_length": len(self.system_template),
                    "prompt_length": len(formatted_prompt),
                    "user_input_length": len(user_input),
                    
                    # 路由信息（扁平化）
                    "routing_route": routing_context["route"],
                    "routing_confidence": routing_context["confidence"],
                    "routing_language": routing_context["language"],
                    "routing_is_chinese": routing_context["is_chinese"],
                    "routing_analysis_method": routing_context["analysis_method"],
                    "include_routing_context": self.include_routing_context,
                    
                    # 记忆信息（扁平化）
                    "memory_has_content": memory_info["has_content"],
                    "memory_format": memory_info["format"],
                    "memory_conversation_rounds": memory_info["conversation_rounds"],
                    "memory_integration": self.memory_integration,
                    
                    # 工具和文档信息（扁平化）
                    "tools_has_results": tools_info["has_results"],
                    "tools_results_count": tools_info["results_count"],
                    "tools_prioritize": self.prioritize_tools,
                    "docs_has_documents": docs_info["has_documents"],
                    "docs_documents_count": docs_info["documents_count"],
                    
                    # LangChain.js兼容性标记
                    "lcel_compatible": True,
                    "langchainjs_ready": True,
                    "runnable_interface": self.enable_runnable_interface,
                    "runnable_type": "agent_prompt",
                    "supports_streaming": True,
                    "supports_async": True,
                    "supports_batching": True,
                    
                    # 环境信息
                    "env_mode": "vercel" if self.vercel_mode else "standard",
                    "flatten_metadata": self.flatten_metadata,
                    "chinese_optimization": self.chinese_prompt_optimization
                }
            elif self.flatten_metadata:
                # 扁平化格式
                return {
                    "prompt_type": "agent",
                    "prompt_mode": self.prompt_mode,
                    "adaptive_generation": self.adaptive_prompt_generation,
                    "has_memory": memory_info["has_content"],
                    "has_tools": tools_info["has_results"],
                    "has_documents": docs_info["has_documents"],
                    "memory_format": memory_info["format"],
                    "memory_conversation_rounds": memory_info["conversation_rounds"],
                    "tools_results_count": tools_info["results_count"],
                    "documents_count": docs_info["documents_count"],
                    "user_input_length": len(user_input),
                    "prompt_length": len(formatted_prompt),
                    "prioritize_tools": self.prioritize_tools,
                    "include_routing_context": self.include_routing_context,
                    "routing_route": routing_context["route"],
                    "routing_confidence": routing_context["confidence"],
                    "routing_language": routing_context["language"],
                    "component_source": "AgentPromptComponent",
                    "lcel_compatible": True,
                    "runnable_interface": self.enable_runnable_interface
                }
            else:
                # 嵌套格式
                return {
                    "prompt_info": {
                        "type": "agent",
                        "mode": self.prompt_mode,
                        "adaptive_generation": self.adaptive_prompt_generation,
                        "template_length": len(self.system_template),
                        "final_length": len(formatted_prompt),
                        "user_input_length": len(user_input)
                    },
                    "routing_context": routing_context,
                    "memory_info": memory_info,
                    "tools_info": tools_info,
                    "documents_info": docs_info,
                    "configuration": {
                        "prioritize_tools": self.prioritize_tools,
                        "include_routing_context": self.include_routing_context,
                        "memory_integration": self.memory_integration,
                        "chinese_optimization": self.chinese_prompt_optimization,
                        "adaptive_prompt_generation": self.adaptive_prompt_generation
                    },
                    "lcel_compatible": True,
                    "runnable_interface": self.enable_runnable_interface,
                    "component_source": "AgentPromptComponent",
                    "timestamp": datetime.now().isoformat()
                }
    
        def update_build_config(self, build_config: dict, field_value: Any, field_name: str | None = None) -> dict:
            """动态更新配置"""
            if field_name == "prompt_mode":
                if field_value == "adaptive":
                    build_config["adaptive_prompt_generation"]["show"] = True
                    build_config["include_routing_context"]["show"] = True
                else:
                    build_config["adaptive_prompt_generation"]["show"] = False
                    build_config["include_routing_context"]["show"] = False
                    
            elif field_name == "langchainjs_export":
                if field_value:
                    build_config["enable_runnable_interface"]["show"] = True
                    build_config["flatten_metadata"]["show"] = True
                    build_config["memory_integration"]["show"] = True
                else:
                    build_config["enable_runnable_interface"]["show"] = False
                    
            elif field_name == "vercel_mode":
                if field_value:
                    build_config["enable_runnable_interface"]["value"] = True
                    build_config["flatten_metadata"]["value"] = True
                    
            elif field_name == "adaptive_prompt_generation":
                if field_value:
                    build_config["include_routing_context"]["show"] = True
                    build_config["chinese_prompt_optimization"]["show"] = True
                else:
                    build_config["include_routing_context"]["show"] = False
                    
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
                "runnable_type": "agent_prompt",
                "supports_streaming": True,
                "supports_async": True,
                "supports_batching": True,
                "memory_compatible": True,
                "langchainjs_exportable": True
            }
    
        # 兼容原有方法
        def build_agent_prompt(self) -> Message:
            """保持向后兼容的方法名"""
            return self.build_lcel_agent_prompt()
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
    