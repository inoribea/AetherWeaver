    from __future__ import annotations
    
    import time
    import os
    import json
    from typing import Any, Dict, List, Union, Optional
    from datetime import datetime
    
    from langchain_core.runnables import Runnable, RunnableLambda, RunnablePassthrough
    from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage
    
    from langflow.custom.custom_component.component import Component
    from langflow.schema.dotdict import dotdict
    from langflow.field_typing.range_spec import RangeSpec  
    from langflow.io import (
        HandleInput,
        MessageInput,
        Output,
        SecretStrInput,
        DropdownInput,
        BoolInput,
        SliderInput, 
        MultilineInput,
        StrInput,
    )
    from langflow.schema.message import Message
    
    class CustomLanguageModelComponent(Component, Runnable):
        display_name = "Main Router Model (LCEL/LangChain.js Compatible)"
        description = "LCEL-compatible language model with customizable API endpoints, routing optimization, RAG support, Agent tools and LangChain.js export"
        icon = "cpu"
        name = "CustomLanguageModelComponent"
    
        inputs = [
            DropdownInput(
                name="provider",
                display_name="Model Provider",
                options=["OpenAI", "Anthropic", "Google", "DeepSeek", "OpenAI-Compatible"],
                value="OpenAI",
                info="Select the model provider",
                options_metadata=[{"icon": "OpenAI"}, {"icon": "Anthropic"}, {"icon": "GoogleGenerativeAI"},{"icon": "DeepSeek"},  {"icon": "Settings"}],
                real_time_refresh=True,
            ),
            BoolInput(
                name="use_custom_model",
                display_name="Use Custom Model",
                value=False,
                info="Enable to use custom model name instead of predefined list",
                real_time_refresh=True,
                advanced=False,
            ),
            StrInput(
                name="custom_model_name",
                display_name="Custom Model Name",
                info="Enter custom model name",
                show=False,
                advanced=False,
                real_time_refresh=True,
                placeholder="Input your custom model name.",
            ),
            DropdownInput(
                name="model_name",
                display_name="Model Name",
                options=["gpt-image-1", "gpt-5", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano","o4-mini","o3-pro-all","text-embedding-3-small",  "claude-sonnet-4-all", "claude-opus-4-thinking-all", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite-preview-06-17", "deepseek-chat", "deepseek-reasoner"],
                value="gpt-5",
                info="Select the model to use",
                real_time_refresh=True,
                show=True,
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
                name="enable_langserve_mode",
                display_name="Enable LangServe Mode",
                value=False,
                info="Enable LangServe deployment optimization",
                advanced=True,
            ),
            SecretStrInput(
                name="openai_api_key",
                display_name="OpenAI API Key",
                info="Your OpenAI API key (supports Vercel env vars)",
                value="",
                advanced=True,
            ),
            SecretStrInput(
                name="anthropic_api_key", 
                display_name="Anthropic API Key",
                info="Your Anthropic API key (supports Vercel env vars)",
                value="",
                advanced=True,
            ),
            SecretStrInput(
                name="google_api_key", 
                display_name="Google API Key",
                info="Your Google API key (supports Vercel env vars)",
                value="",
                advanced=True,
            ),
            BoolInput(
                name="use_custom_url",
                display_name="Use Custom Base URL",
                value=False,
                info="Enable to use custom API endpoint URL",
                advanced=True,
            ),
            StrInput(
                name="base_url",
                display_name="Custom Base URL",
                info="Custom API endpoint URL",
                placeholder="https://api.example.com/v1",
                show=True,
                advanced=True,
            ),
            MessageInput(
                name="input_value",
                display_name="Input",
                info="User input message or prompt from AgentPromptComponent",
                required=True,
            ),
            MessageInput(
                name="routing_context",
                display_name="Routing Context",
                info="Routing information from SmartRouting component",
                required=False,
            ),
            MessageInput(
                name="context_documents",
                display_name="Context Documents",
                info="Retrieved documents from vector store for RAG",
                required=False,
            ),
            MessageInput(
                name="tools",
                display_name="Tools",
                info="Available tools for agent execution (Tavily Search, ArXiv, etc.)",
                required=False,
            ),
            MessageInput(
                name="memory_context",
                display_name="Memory Context",
                info="Memory context from ChatMemory component",
                required=False,
            ),
            MultilineInput(
                name="system_message",
                display_name="System Message", 
                info="Base system message (will be enhanced with memory and routing)",
                value="你是一个智能AI助手。",
                show=False,
                advanced=True,
            ),
            BoolInput(
                name="stream_output",
                display_name="Stream",
                info="Enable streaming responses",
                value=False,
            ),
            SliderInput(
                name="temperature",
                display_name="Temperature",
                info="Controls randomness (0.0 to 2.0)",
                value=0.1,
                range_spec=RangeSpec(min=0.0, max=2.0, step=0.01, step_type="float"),
                advanced=True,
            ),
            SliderInput(
                name="max_tokens",
                display_name="Max Tokens",
                info="Maximum number of tokens to generate",
                value=1000,
                range_spec=RangeSpec(min=1, max=8192, step=1, step_type="int"),
                advanced=True,
            ),
            SliderInput(
                name="top_p",
                display_name="Top P",
                info="Controls diversity via nucleus sampling (0.0 to 1.0)",
                value=1.0,
                range_spec=RangeSpec(min=0.01, max=1.0, step=0.01, step_type="float"),
                advanced=True,
            ),
        ]
    
        outputs = [
            Output(
                display_name="LCEL Model Output",
                name="lcel_model_output",
                method="get_lcel_model_output",
            ),
        ]
    
        def _load_environment_config(self) -> Dict[str, Any]:
            """加载环境变量配置，支持Vercel模式"""
            
            default_config = {
                "model_configurations": {
                    "openai": {
                        "api_key_env": "OPENAI_API_KEY",
                        "default_models": ["gpt-image-1", "gpt-5", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano","o4-mini","o3-pro-all","text-embedding-3-small"],
                        "supports_json_mode": True,
                        "supports_tools": True
                    },
                    "anthropic": {
                        "api_key_env": "ANTHROPIC_API_KEY",
                        "default_models": ["claude-sonnet-4-all", "claude-opus-4-thinking-all", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite-preview-06-17"],
                        "supports_json_mode": False,
                        "supports_tools": True
                    },
                    "google": {
                        "api_key_env": "GOOGLE_API_KEY",
                        "default_models": ["gemini-2.5-pro", "gemini-2.5-flash"],
                        "supports_json_mode": True,
                        "supports_tools": True
                    },
                    "deepseek": {
                        "api_key_env": "DEEPSEEK_API_KEY",
                        "default_models": ["deepseek-chat", "deepseek-reasoner"],
                        "supports_json_mode": True,
                        "supports_tools": True
                    }
                },
                "routing_enhancements": {
                    "basic": {"temperature_adjust": -0.1, "max_tokens_adjust": -200},
                    "enhanced": {"temperature_adjust": 0.1, "max_tokens_adjust": 500},
                    "rag": {"temperature_adjust": -0.2, "max_tokens_adjust": 0},
                    "agent": {"temperature_adjust": 0.0, "max_tokens_adjust": 200}
                },
                "memory_integration": {
                    "langflow_chat_memory": True,
                    "custom_memory": True,
                    "max_history_tokens": 2000,
                    "summarize_long_history": True
                },
                "lcel_configuration": {
                    "enable_runnable": self.enable_runnable_interface,
                    "enable_streaming": True,
                    "enable_async": True,
                    "enable_batching": True,
                    "langserve_mode": self.enable_langserve_mode
                },
                "langchainjs_compatibility": {
                    "export_format": self.langchainjs_export,
                    "flatten_metadata": self.flatten_metadata,
                    "runnable_interface": self.enable_runnable_interface,
                    "model_field_name": "model",  # 使用"model"而不是"model_name"
                    "openai_format": True
                }
            }
            
            try:
                if self.vercel_mode:
                    config_str = os.getenv("LANGFLOW_LANGUAGE_MODEL_CONFIG", "{}")
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
                    config_str = os.getenv("LANGUAGE_MODEL_CONFIG", "{}")
                    env_config = json.loads(config_str) if config_str else {}
                    default_config.update(env_config)
                    
            except (json.JSONDecodeError, TypeError):
                pass
                
            return default_config
    
        def extract_routing_info(self, routing_context: Message = None) -> dict:
            """安全提取路由信息，包括记忆"""
            routing_info = {
                "route": "auto",
                "confidence": 0.7,
                "language": "auto",
                "is_chinese": False,
                "conversation_history": "",
                "has_memory": False,
                "metadata": {},
                "analysis_method": "unknown",
                "memory_format": "none",
                "original_text": ""
            }
            
            try:
                if routing_context and hasattr(routing_context, 'metadata') and routing_context.metadata:
                    metadata = routing_context.metadata
                    routing_info["metadata"] = metadata
                    
                    # 支持扁平化和嵌套格式
                    if self.flatten_metadata:
                        # 扁平化格式
                        routing_info.update({
                            "route": metadata.get('routing_decision') or metadata.get('route', 'auto'),
                            "confidence": metadata.get('confidence', 0.7),
                            "conversation_history": metadata.get('conversation_history', ''),
                            "has_memory": metadata.get('has_memory', False),
                            "analysis_method": metadata.get('analysis_method', 'unknown'),
                            "memory_format": metadata.get('memory_format', 'none'),
                            "original_text": metadata.get('original_user_input', ''),
                            "is_chinese": metadata.get('routing_is_chinese', False)
                        })
                    else:
                        # 嵌套格式
                        memory_info = metadata.get('memory', {})
                        routing_info.update({
                            "route": metadata.get('routing_decision') or metadata.get('route', 'auto'),
                            "confidence": metadata.get('confidence', 0.7),
                            "conversation_history": memory_info.get('conversation_history', ''),
                            "has_memory": memory_info.get('has_memory', False),
                            "analysis_method": metadata.get('analysis_method', 'unknown'),
                            "memory_format": memory_info.get('memory_format', 'none'),
                            "original_text": metadata.get('original_user_input', ''),
                            "is_chinese": metadata.get('routing_is_chinese', False)
                        })
                            
            except Exception as e:
                self.status = f"⚠️ 路由信息提取失败: {str(e)[:30]}..."
            
            return routing_info
    
        def extract_context_documents(self, context_documents: Message = None) -> List[str]:
            """提取并格式化上下文文档为列表"""
            if not context_documents:
                return []
            
            try:
                docs = []
                
                if hasattr(context_documents, 'text') and context_documents.text:
                    text = str(context_documents.text)
                    if '\n\n' in text:
                        docs = [doc.strip() for doc in text.split('\n\n') if doc.strip()]
                    else:
                        docs = [text]
                        
                elif hasattr(context_documents, 'data') and context_documents.data:
                    data = context_documents.data
                    if isinstance(data, list):
                        for doc in data:
                            if hasattr(doc, 'page_content'):
                                docs.append(doc.page_content)
                            elif hasattr(doc, 'text'):
                                docs.append(doc.text)
                            elif isinstance(doc, str):
                                docs.append(doc)
                            else:
                                docs.append(str(doc))
                    else:
                        if hasattr(data, 'page_content'):
                            docs.append(data.page_content)
                        elif hasattr(data, 'text'):
                            docs.append(data.text)
                        else:
                            docs.append(str(data))
                else:
                    docs = [str(context_documents)]
                
                cleaned_docs = []
                for doc in docs:
                    cleaned = doc.strip()
                    if cleaned and len(cleaned) > 10:
                        cleaned_docs.append(cleaned)
                
                return cleaned_docs
                    
            except Exception as e:
                self.status = f"⚠️ 文档提取失败: {str(e)[:30]}..."
                return []
    
        def extract_tools_info(self, tools: Message = None) -> List[Dict[str, Any]]:
            """提取并格式化工具信息为列表"""
            if not tools:
                return []
            
            try:
                tools_list = []
                
                if hasattr(tools, 'text') and tools.text:
                    text = str(tools.text)
                    tools_list.append({"name": "text_tool", "description": text})
                    
                elif hasattr(tools, 'data') and tools.data:
                    data = tools.data
                    if isinstance(data, list):
                        for tool in data:
                            if isinstance(tool, dict):
                                tools_list.append(tool)
                            else:
                                tools_list.append({"name": "unknown_tool", "description": str(tool)})
                    else:
                        if isinstance(data, dict):
                            tools_list.append(data)
                        else:
                            tools_list.append({"name": "unknown_tool", "description": str(data)})
                else:
                    tools_list.append({"name": "unknown_tool", "description": str(tools)})
                
                return tools_list
                    
            except Exception as e:
                self.status = f"⚠️ 工具提取失败: {str(e)[:30]}..."
                return []
    
        def extract_memory_context(self, memory_context: Message = None) -> Dict[str, Any]:
            """提取记忆上下文信息"""
            memory_info = {
                "has_memory": False,
                "content": "",
                "format": "none",
                "processed_content": ""
            }
            
            try:
                if not memory_context:
                    return memory_info
                
                if hasattr(memory_context, 'text') and memory_context.text:
                    content = str(memory_context.text)
                    memory_info.update({
                        "has_memory": True,
                        "content": content,
                        "format": "text",
                        "processed_content": content
                    })
                
                if hasattr(memory_context, 'metadata') and memory_context.metadata:
                    metadata = memory_context.metadata
                    if self.flatten_metadata:
                        memory_info.update({
                            "format": metadata.get('memory_format', 'text'),
                            "conversation_rounds": metadata.get('memory_conversation_rounds', 0)
                        })
                    else:
                        memory_meta = metadata.get('memory_info', {})
                        memory_info.update({
                            "format": memory_meta.get('format', 'text'),
                            "conversation_rounds": memory_meta.get('conversation_rounds', 0)
                        })
            
            except Exception as e:
                self.status = f"⚠️ 记忆提取失败: {str(e)[:30]}..."
            
            return memory_info
    
        def _detect_chinese(self, text: str) -> bool:
            """检测文本是否包含中文"""
            if not text:
                return False
            
            chinese_chars = sum(1 for char in text if '\u4e00' <= char <= '\u9fff')
            return chinese_chars > len(text) * 0.3
    
        def get_optimized_system_message(self, routing_context: Message = None, 
                                        memory_context: Message = None) -> str:
            """根据路由上下文和记忆动态获取system message"""
            
            routing_info = self.extract_routing_info(routing_context)
            memory_info = self.extract_memory_context(memory_context)
            routing_mode = routing_info["route"]
            is_chinese = routing_info["is_chinese"]
            conversation_history = routing_info["conversation_history"]
            has_memory = routing_info["has_memory"] or memory_info["has_memory"]
            
            base_system_message = self.system_message
            
            if is_chinese:
                route_prompts = {
                    "basic": f"{base_system_message}\n\n当前模式：基础对话模式。请提供简洁、直接、友好的回答。",
                    "enhanced": f"{base_system_message}\n\n当前模式：增强分析模式。请提供深入、专业、详细的分析和解答。",
                    "rag": f"{base_system_message}\n\n当前模式：知识检索模式。基于提供的参考文档回答用户问题，确保答案准确性。",
                    "agent": f"{base_system_message}\n\n当前模式：工具执行模式。你可以使用提供的工具来完成任务。请根据用户需求选择合适的工具，并基于工具结果提供答案。"
                }
            else:
                route_prompts = {
                    "basic": f"{base_system_message}\n\nMode: Basic conversation. Provide concise, direct answers.",
                    "enhanced": f"{base_system_message}\n\nMode: Enhanced analysis. Provide in-depth, professional analysis.",
                    "rag": f"{base_system_message}\n\nMode: Knowledge retrieval. Answer based on provided reference documents.",
                    "agent": f"{base_system_message}\n\nMode: Tool execution. You can use the provided tools to complete tasks. Choose appropriate tools based on user needs and provide answers based on tool results."
                }
            
            dynamic_prompt = route_prompts.get(routing_mode, route_prompts["basic"])
            
            # 整合记忆信息
            all_memory_content = ""
            if conversation_history:
                all_memory_content = conversation_history
            elif memory_info["has_memory"]:
                all_memory_content = memory_info["processed_content"]
            
            if has_memory and all_memory_content:
                memory_section = f"""
    
    📝 对话历史记忆:
    {all_memory_content}
    
    请基于对话历史提供连贯的回答。""" if is_chinese else f"""
    
    📝 Conversation History:
    {all_memory_content}
    
    Please provide coherent responses based on conversation history."""
                
                dynamic_prompt += memory_section
            
            return dynamic_prompt
    
        def get_effective_model_name(self) -> str:
            """获取实际使用的模型名称"""
            if self.use_custom_model and hasattr(self, 'custom_model_name') and self.custom_model_name.strip():
                return self.custom_model_name.strip()
            else:
                return self.model_name
    
        def get_effective_api_key(self, provider: str, env_config: Dict[str, Any]) -> str:
            """获取有效的API密钥，支持Vercel模式"""
            
            # 首先尝试从组件输入获取
            if provider == "OpenAI":
                api_key = self.openai_api_key
            elif provider == "Anthropic":
                api_key = self.anthropic_api_key
            elif provider == "Google":
                api_key = self.google_api_key
            else:
                api_key = ""
            
            # 如果没有或者是Vercel模式，尝试从环境变量获取
            if not api_key or self.vercel_mode:
                model_config = env_config.get("model_configurations", {}).get(provider.lower(), {})
                env_key = model_config.get("api_key_env", f"{provider.upper()}_API_KEY")
                env_api_key = os.getenv(env_key)
                if env_api_key:
                    api_key = env_api_key
            
            return api_key
    
        def adjust_parameters_for_route(self, routing_info: Dict[str, Any], 
                                       env_config: Dict[str, Any]) -> Dict[str, Any]:
            """根据路由调整模型参数"""
            
            route = routing_info["route"]
            routing_enhancements = env_config.get("routing_enhancements", {})
            route_config = routing_enhancements.get(route, {})
            
            # 基础参数
            adjusted_params = {
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
                "top_p": self.top_p
            }
            
            # 根据路由调整参数
            temp_adjust = route_config.get("temperature_adjust", 0)
            token_adjust = route_config.get("max_tokens_adjust", 0)
            
            adjusted_params["temperature"] = max(0.0, min(2.0, adjusted_params["temperature"] + temp_adjust))
            adjusted_params["max_tokens"] = max(1, min(8192, adjusted_params["max_tokens"] + token_adjust))
            
            return adjusted_params
    
        def build_messages(self, routing_context: Message = None, 
                          memory_context: Message = None) -> list:
            """构建消息列表，支持 RAG 和 Agent 模式，兼容LCEL"""
            
            routing_info = self.extract_routing_info(routing_context)
            route = routing_info["route"]
            is_chinese = routing_info["is_chinese"]
            
            user_input = self.input_value.text if hasattr(self.input_value, 'text') else str(self.input_value)
            
            optimized_system_message = self.get_optimized_system_message(routing_context, memory_context)
            
            if route == "rag":
                context_docs = self.extract_context_documents(getattr(self, 'context_documents', None))
                
                if context_docs:
                    if is_chinese:
                        docs_text = ""
                        for i, doc in enumerate(context_docs, 1):
                            docs_text += f"文档{i}:\n{doc}\n\n"
                        
                        final_user_message = f"""参考以下文档回答用户问题:
    
    {docs_text}用户问题: {user_input}"""
                    else:
                        docs_text = ""
                        for i, doc in enumerate(context_docs, 1):
                            docs_text += f"Document {i}:\n{doc}\n\n"
                        
                        final_user_message = f"""Please answer the user's question based on the following reference documents:
    
    {docs_text}User Question: {user_input}"""
                else:
                    if is_chinese:
                        final_user_message = f"没有找到相关参考文档。请基于您的知识回答以下问题:\n\n{user_input}"
                    else:
                        final_user_message = f"No relevant reference documents found. Please answer the following question based on your knowledge:\n\n{user_input}"
            
            elif route == "agent":
                tools_info = self.extract_tools_info(getattr(self, 'tools', None))
                
                if tools_info:
                    if is_chinese:
                        tools_text = "可用工具:\n"
                        for i, tool in enumerate(tools_info, 1):
                            tool_name = tool.get('name', f'工具{i}')
                            tool_desc = tool.get('description', '无描述')
                            tools_text += f"{i}. {tool_name}: {tool_desc}\n"
                        
                        final_user_message = f"""{tools_text}
    
    用户请求: {user_input}
    
    请选择合适的工具来完成用户请求。"""
                    else:
                        tools_text = "Available tools:\n"
                        for i, tool in enumerate(tools_info, 1):
                            tool_name = tool.get('name', f'Tool{i}')
                            tool_desc = tool.get('description', 'No description')
                            tools_text += f"{i}. {tool_name}: {tool_desc}\n"
                        
                        final_user_message = f"""{tools_text}
    
    User Request: {user_input}
    
    Please choose appropriate tools to fulfill the user's request."""
                else:
                    if is_chinese:
                        final_user_message = f"当前没有可用工具。请基于您的知识回答以下问题:\n\n{user_input}"
                    else:
                        final_user_message = f"No tools available. Please answer the following question based on your knowledge:\n\n{user_input}"
            
            else:
                final_user_message = user_input
            
            effective_model_name = self.get_effective_model_name()
            is_o1_model = effective_model_name and effective_model_name.startswith("o1")
            
            # LCEL兼容的消息构建
            if optimized_system_message and not is_o1_model:
                messages = [
                    SystemMessage(content=optimized_system_message),
                    HumanMessage(content=final_user_message)
                ]
                return messages
            else:
                if is_o1_model and optimized_system_message:
                    combined_message = f"{optimized_system_message}\n\n{final_user_message}"
                else:
                    combined_message = final_user_message
                
                return [HumanMessage(content=combined_message)]
    
        def build_model(self, env_config: Dict[str, Any], routing_info: Dict[str, Any]):
            """构建语言模型实例，兼容LCEL和LangChain.js，并正确处理自定义URL"""
            effective_model_name = self.get_effective_model_name()
            
            if self.use_custom_model and not hasattr(self, 'custom_model_name'):
                raise ValueError("Custom model name is required when 'Use Custom Model' is enabled")
            
            # 获取调整后的参数
            adjusted_params = self.adjust_parameters_for_route(routing_info, env_config)
            
            # 确定实际的模型提供商 (如果使用自定义URL，则强制为OpenAI-Compatible)
            actual_provider = self.provider
            if self.use_custom_url and self.base_url and self.base_url.strip():
                # 当使用自定义URL时，假定OneAPI提供的是OpenAI兼容接口
                actual_provider = "OpenAI-Compatible" 
     
            try:
                # 统一使用 ChatOpenAI 来处理自定义 URL 的情况
                if actual_provider in ["OpenAI", "Deepseek", "OpenAI-Compatible", "Anthropic", "Google"]: # 将Anthropic和Google也纳入OpenAI兼容处理
                    from langchain_openai import ChatOpenAI
                    # 对于Anthropic和Google，如果通过OneAPI代理，其API Key实际就是OpenAI-Compatible的Key
                    # 所以我们这里需要根据原始provider来获取对应的key，OneAPI会做转发
                    # 注意：OneAPI可能只接受OpenAI格式的API Key，你需要确保传入的Key格式正确
                    if self.provider == "Anthropic":
                        api_key = self.get_effective_api_key("Anthropic", env_config) # 尽管是OpenAI客户端，但使用Anthropic的key变量名
                    elif self.provider == "Google":
                        api_key = self.get_effective_api_key("Google", env_config) # 同上
                    elif self.provider == "Deepseek":
                        api_key = self.get_effective_api_key("Deepseek", env_config)
                    else: # OpenAI 和 OpenAI-Compatible
                        api_key = self.get_effective_api_key("OpenAI", env_config)
                    
                    if not api_key:
                        raise ValueError(f"{self.provider} API key is required, or Custom Base URL is not correctly configured for OpenAI-Compatible mode.")
                    
                    # 确定 base_url
                    # 如果是OpenAI-Compatible或开启了use_custom_url，则使用自定义url
                    # 否则，对于OpenAI，默认Langchain会使用其官方URL
                    base_url_to_use = self.base_url if self.use_custom_url or actual_provider == "OpenAI-Compatible" else None
                    
                    openai_kwargs = {
                        "model": effective_model_name,
                        "api_key": api_key,
                        "temperature": adjusted_params["temperature"],
                        "max_tokens": adjusted_params["max_tokens"],
                        "top_p": adjusted_params["top_p"],
                        "streaming": self.stream_output,
                    }
                    
                    if base_url_to_use:
                        openai_kwargs["base_url"] = base_url_to_use
                    
                    if self.enable_langserve_mode:
                        openai_kwargs["model_kwargs"] = {
                            "response_format": {"type": "text"}
                        }
                    
                    return ChatOpenAI(**openai_kwargs)
                    
                # 如果是Anthropic和Google，且没有使用自定义URL，则继续使用各自的客户端
                # 这种情况是为了直接连接官方API，而不是通过OneAPI
                elif self.provider == "Anthropic":
                    from langchain_anthropic import ChatAnthropic
                    api_key = self.get_effective_api_key("Anthropic", env_config)
                    if not api_key:
                        raise ValueError("Anthropic API key is required")
                    
                    # Anthropic 客户端不支持直接的 base_url 参数，通常通过 ANTHROPIC_API_BASE 环境变量控制
                    # 如果你在这里仍然想通过 OneAPI 代理，但又不想切换到 OpenAI-Compatible，
                    # 那么你需要在这里设置 os.environ["ANTHROPIC_API_BASE"] = self.base_url
                    # 但这种做法不推荐，因为环境变量是全局的，可能影响其他组件或模块。
                    # 更好的做法是统一使用 ChatOpenAI。
                    return ChatAnthropic(
                        model=effective_model_name,
                        api_key=api_key,
                        temperature=adjusted_params["temperature"],
                        max_tokens=adjusted_params["max_tokens"],
                        top_p=adjusted_params["top_p"],
                        streaming=self.stream_output,
                    )
                    
                elif self.provider == "Google":
                    from langchain_google_genai import ChatGoogleGenerativeAI
                    api_key = self.get_effective_api_key("Google", env_config)
                    if not api_key:
                        raise ValueError("Google API key is required")
                    
                    # Google GenAI 客户端也不支持直接的 base_url 参数
                    # 同样，如果要通过 OneAPI 代理，推荐使用 ChatOpenAI
                    return ChatGoogleGenerativeAI(
                        model=effective_model_name,
                        google_api_key=api_key,
                        temperature=adjusted_params["temperature"],
                        max_output_tokens=adjusted_params["max_tokens"],
                        top_p=adjusted_params["top_p"],
                        streaming=self.stream_output,
                    )
                
                else:
                    raise ValueError(f"Unsupported model provider: {self.provider}")
                    
            except Exception as e:
                raise ValueError(f"Failed to build model for {self.provider} with model {effective_model_name}: {str(e)}")
    
        # LCEL Runnable接口实现
        def invoke(self, input_data: Any, config: Optional[Dict] = None) -> Message:
            """LCEL Runnable.invoke方法实现"""
            # 临时设置输入数据
            original_input = getattr(self, 'input_value', None)
            self.input_value = input_data if isinstance(input_data, Message) else Message(text=str(input_data))
            
            try:
                result = self.get_lcel_model_output()
                return result
            finally:
                # 恢复原始输入
                self.input_value = original_input
    
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
    
        def get_lcel_model_output(self) -> Message:
            """获取LCEL兼容的模型输出"""
            
            start_time = time.time()
            
            try:
                # 加载环境配置
                env_config = self._load_environment_config()
                
                # 提取上下文信息
                routing_info = self.extract_routing_info(self.routing_context)
                memory_info = self.extract_memory_context(getattr(self, 'memory_context', None))
                route = routing_info["route"]
                confidence = routing_info["confidence"]
                has_memory = routing_info["has_memory"] or memory_info["has_memory"]
                
                has_rag_context = bool(self.extract_context_documents(getattr(self, 'context_documents', None)))
                has_tools = bool(self.extract_tools_info(getattr(self, 'tools', None)))
                
                # 构建模型和消息
                model = self.build_model(env_config, routing_info)
                messages = self.build_messages(self.routing_context, getattr(self, 'memory_context', None))
                
                # 调用模型
                response = model.invoke(messages)
                result_text = response.content
                
                execution_time = int((time.time() - start_time) * 1000)
                
                # 构建输出metadata
                output_metadata = self._create_model_metadata(
                    routing_info, memory_info, execution_time, result_text, 
                    has_rag_context, has_tools, env_config
                )
                
                # 生成状态指示器
                memory_indicator = "💬" if memory_info["format"] == "langflow_chat_memory" else ("📝" if has_memory else "🆕")
                rag_indicator = "📚" if has_rag_context else ""
                tool_indicator = "🔧" if has_tools else ""
                param_info = f"T:{self.temperature:.2f}|P:{self.top_p:.2f}"
                
                self.status = f"✅ {route.upper()} ({confidence:.2f}) | {execution_time}ms | {len(result_text)} chars | {param_info} {memory_indicator}{rag_indicator}{tool_indicator}"
                
                return Message(text=result_text, metadata=output_metadata)
                
            except Exception as e:
                error_time = int((time.time() - start_time) * 1000)
                self.status = f"❌ Error: {str(e)[:50]}... | {error_time}ms"
                return Message(
                    text=f"抱歉，模型执行出现错误：{str(e)}",
                    metadata={
                        "error": str(e), 
                        "execution_time_ms": error_time,
                        "component_source": "CustomLanguageModelComponent"
                    }
                )
    
        def _create_model_metadata(self, routing_info: Dict, memory_info: Dict,
                                  execution_time: int, result_text: str, has_rag_context: bool,
                                  has_tools: bool, env_config: Dict) -> Dict[str, Any]:
            """创建模型输出metadata，支持LCEL和LangChain.js兼容性"""
            
            if self.langchainjs_export:
                # LangChain.js兼容格式（扁平化）
                return {
                    # LangChain.js核心字段
                    "type": "model_output",
                    "source": "langflow",
                    "component": "CustomLanguageModelComponent",
                    "version": "1.0",
                    "timestamp": datetime.now().isoformat(),
                    
                    # 模型信息
                    "model_provider": self.provider,
                    "model_name": self.get_effective_model_name(),
                    "model_temperature": self.temperature,
                    "model_max_tokens": self.max_tokens,
                    "model_top_p": self.top_p,
                    "model_streaming": self.stream,
                    
                    # 路由信息（扁平化）
                    "routing_route": routing_info["route"],
                    "routing_confidence": routing_info["confidence"],
                    "routing_language": routing_info["language"],
                    "routing_is_chinese": routing_info["is_chinese"],
                    "routing_analysis_method": routing_info["analysis_method"],
                    
                    # 执行信息
                    "execution_time_ms": execution_time,
                    "response_length": len(result_text),
                    "execution_timestamp": time.time(),
                    
                    # 上下文信息（扁平化）
                    "has_memory": memory_info["has_memory"],
                    "memory_format": memory_info["format"],
                    "has_rag_context": has_rag_context,
                    "has_tools": has_tools,
                    
                    # LangChain.js兼容性标记
                    "lcel_compatible": True,
                    "langchainjs_ready": True,
                    "runnable_interface": self.enable_runnable_interface,
                    "runnable_type": "language_model",
                    "supports_streaming": True,
                    "supports_async": True,
                    "supports_batching": True,
                    
                    # 环境信息
                    "env_mode": "vercel" if self.vercel_mode else "standard",
                    "langserve_mode": self.enable_langserve_mode,
                    "flatten_metadata": self.flatten_metadata
                }
            elif self.flatten_metadata:
                # 扁平化格式
                return {
                    "model_provider": self.provider,
                    "model_name": self.get_effective_model_name(),
                    "model_temperature": self.temperature,
                    "model_max_tokens": self.max_tokens,
                    "model_top_p": self.top_p,
                    "routing_route": routing_info["route"],
                    "routing_confidence": routing_info["confidence"],
                    "routing_language": routing_info["language"],
                    "routing_analysis_method": routing_info["analysis_method"],
                    "execution_time_ms": execution_time,
                    "response_length": len(result_text),
                    "has_memory": memory_info["has_memory"],
                    "memory_format": memory_info["format"],
                    "has_rag_context": has_rag_context,
                    "has_tools": has_tools,
                    "component_source": "CustomLanguageModelComponent",
                    "lcel_compatible": True,
                    "runnable_interface": self.enable_runnable_interface
                }
            else:
                # 嵌套格式
                return {
                    "model_info": {
                        "provider": self.provider,
                        "name": self.get_effective_model_name(),
                        "parameters": {
                            "temperature": self.temperature,
                            "max_tokens": self.max_tokens,
                            "top_p": self.top_p,
                            "streaming": self.stream
                        }
                    },
                    "routing_info": routing_info,
                    "memory_info": memory_info,
                    "execution_info": {
                        "time_ms": execution_time,
                        "response_length": len(result_text),
                        "timestamp": time.time()
                    },
                    "context_info": {
                        "has_rag_context": has_rag_context,
                        "has_tools": has_tools,
                        "has_memory": memory_info["has_memory"]
                    },
                    "lcel_compatible": True,
                    "runnable_interface": self.enable_runnable_interface,
                    "component_source": "CustomLanguageModelComponent"
                }
    
        def update_build_config(self, build_config: dotdict, field_value: Any, field_name: str | None = None) -> dotdict:
            """更新构建配置，支持动态UI更新"""
            if field_name == "use_custom_model":
                if field_value:
                    build_config["model_name"]["show"] = False
                    build_config["custom_model_name"]["show"] = True
                else:
                    build_config["model_name"]["show"] = True
                    build_config["custom_model_name"]["show"] = False
                    
            elif field_name == "use_custom_url":
                if field_value:
                    build_config["base_url"]["show"] = True
                else:
                    build_config["base_url"]["show"] = False
                    
            elif field_name == "provider":
                # 根据提供商更新模型选项
                if field_value == "OpenAI":
                    build_config["model_name"]["options"] = ["gpt-image-1", "gpt-5", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano","o4-mini","o3-pro-all","text-embedding-3-small"]
                    build_config["openai_api_key"]["show"] = True
                    build_config["anthropic_api_key"]["show"] = False
                    build_config["google_api_key"]["show"] = False
                elif field_value == "Anthropic":
                    build_config["model_name"]["options"] = ["claude-sonnet-4-all", "claude-opus-4-thinking-all", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite-preview-06-17"]
                    build_config["openai_api_key"]["show"] = False
                    build_config["anthropic_api_key"]["show"] = True
                    build_config["google_api_key"]["show"] = False
                elif field_value == "Google":
                    build_config["model_name"]["options"] = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite-preview-06-17"]
                    build_config["openai_api_key"]["show"] = False
                    build_config["anthropic_api_key"]["show"] = False
                    build_config["google_api_key"]["show"] = True
                elif field_value == "DeepSeek":
                    build_config["model_name"]["options"] = ["deepseek-chat", "deepseek-reasoner"]
                    build_config["openai_api_key"]["show"] = True
                    build_config["anthropic_api_key"]["show"] = False
                    build_config["google_api_key"]["show"] = False
                    
            elif field_name == "langchainjs_export":
                if field_value:
                    build_config["enable_runnable_interface"]["show"] = True
                    build_config["flatten_metadata"]["show"] = True
                    build_config["enable_langserve_mode"]["show"] = True
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
                "runnable_type": "language_model",
                "supports_streaming": True,
                "supports_async": True,
                "supports_batching": True,
                "memory_compatible": True,
                "langchainjs_exportable": True
            }
    
        # 保持向后兼容
        def get_model_output(self) -> Message:
            """保持向后兼容的方法名"""
            return self.get_lcel_model_output()
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