```
from __future__ import annotations

import time
import uuid
from typing import Any, Dict

from langflow.custom.custom_component.component import Component
from langflow.io import HandleInput, MessageInput, Output, DropdownInput, BoolInput
from langflow.schema.message import Message

class OptimizedSmartRoutingFunction(Component):
    display_name = "Optimized Smart Routing Function"
    description = "LCEL-compatible LLM-powered intelligent routing with enhanced decision logic and memory support"
    icon = "square-function"
    name = "OptimizedSmartRoutingFunction"

    inputs = [
        MessageInput(
            name="input_message",
            display_name="Input Message",
            info="Enhanced message from RoutingChatOutput or MessageMemory with routing analysis",
            required=True,
        ),
        HandleInput(
            name="llm",
            display_name="Language Model",
            info="Language Model for intelligent routing analysis",
            input_types=["LanguageModel"],
            required=False,
        ),
        DropdownInput(
            name="analysis_mode",
            display_name="Analysis Mode",
            options=["llm_enhanced", "hybrid", "fast_rule"],
            value="hybrid",
            info="Routing analysis strategy",
            advanced=False,
        ),
        BoolInput(
            name="enable_confidence_boost",
            display_name="Enable Confidence Boost",
            info="Use pre-analysis to boost confidence",
            value=True,
            advanced=True,
        ),
        DropdownInput(
            name="default_route",
            display_name="Default Route",
            options=["basic", "enhanced", "rag", "agent"],
            value="basic",
            info="Fallback route when analysis fails",
            advanced=True,
        ),
        BoolInput(
            name="pass_route_as_text",
            display_name="Pass Route as Text",
            info="If enabled, pass route decision as text; if disabled, pass original user input",
            value=False,
            advanced=False,
        ),
        BoolInput(
            name="include_route_in_text",
            display_name="Include Route in Text",
            info="If enabled, prepend route decision to original text",
            value=False,
            advanced=False,
        ),
    ]

    outputs = [
        Output(
            display_name="LCEL Routing Output",
            name="lcel_routing_output",
            method="get_lcel_routing_output"
        ),
    ]

    def safe_extract_routing_data(self, message_input: Any) -> Dict[str, Any]:
        """安全提取路由数据，包括记忆信息"""
        routing_data = {
            "text": "",
            "conversation_history": "",
            "pre_analysis": {},
            "routing_hint": None,
            "confidence": 0.5,
            "metadata": {}
        }
        
        try:
            if message_input is None:
                return routing_data
            
            # 处理Message对象
            if hasattr(message_input, 'text'):
                full_text = str(message_input.text) if message_input.text else ""
                
                # 检查是否来自MessageMemory（包含对话历史）
                if '\n' in full_text and ('Human:' in full_text or 'Assistant:' in full_text or 'User:' in full_text):
                    # 来自MessageMemory的格式化对话历史
                    lines = full_text.split('\n')
                    
                    # 提取当前用户输入（通常是最后一行或最后的Human/User消息）
                    current_input = ""
                    conversation_lines = []
                    
                    for line in reversed(lines):
                        line = line.strip()
                        if not line:
                            continue
                        if line.startswith(('Human:', 'User:')) and not current_input:
                            current_input = line.split(':', 1)[1].strip()
                        else:
                            conversation_lines.insert(0, line)
                    
                    routing_data["text"] = current_input or full_text
                    routing_data["conversation_history"] = '\n'.join(conversation_lines) if conversation_lines else ""
                else:
                    # 普通用户输入
                    routing_data["text"] = full_text
                
                # 提取metadata中的预分析结果
                if hasattr(message_input, 'metadata') and message_input.metadata:
                    metadata = message_input.metadata
                    routing_data["metadata"] = metadata
                    
                    # 提取预分析结果
                    if 'routing_analysis' in metadata:
                        routing_data["pre_analysis"] = metadata['routing_analysis']
                        routing_data["routing_hint"] = metadata['routing_analysis'].get('routing_decision')
                        routing_data["confidence"] = metadata['routing_analysis'].get('confidence', 0.5)
                    
                    # 直接提取路由提示
                    routing_data["routing_hint"] = routing_data["routing_hint"] or metadata.get('routing_hint') or metadata.get('route')
            else:
                routing_data["text"] = str(message_input) if message_input else ""
            
            return routing_data
            
        except Exception as e:
            self.status = f"❌ Data extraction error: {str(e)[:30]}..."
            return routing_data

    def enhanced_rule_analysis(self, text: str, conversation_history: str = "") -> Dict[str, Any]:
        """增强的规则分析，考虑对话历史"""
        text_lower = text.lower()
        history_lower = conversation_history.lower()
        
        # 基于历史上下文的分析
        if conversation_history:
            # 检查历史中的创作类任务延续
            if any(word in history_lower for word in ["写", "创作", "诗", "sonnet", "故事", "小说"]):
                if any(word in text_lower for word in ["继续", "接着", "下一", "更多", "再来"]):
                    return {"route": "enhanced", "confidence": 0.85, "method": "rule_history_enhanced"}
            
            # 检查历史中的搜索类任务延续
            if any(word in history_lower for word in ["查找", "搜索", "检索", "资料"]):
                if any(word in text_lower for word in ["继续", "更多", "详细", "还有"]):
                    return {"route": "rag", "confidence": 0.8, "method": "rule_history_rag"}
        
        # Enhanced 路由的关键词
        enhanced_keywords = [
            "写", "创作", "生成", "编写", "作文", "诗", "sonnet", "小说", "故事", "剧本",
            "分析", "解释", "详细", "深入", "专业", "复杂", "全面", "系统",
            "研究", "理论", "学术", "论文", "报告", "方案", "策略",
            "技术", "算法", "代码", "编程", "开发", "设计", "架构",
            "建议", "指导", "方案", "规划", "优化", "改进"
        ]
        
        # Agent 路由的关键词
        agent_keywords = [
            "计算", "执行", "调用", "运行", "查询", "搜索", "获取", "下载", 
            "上传", "发送", "处理", "转换", "翻译", "api", "tool", "工具"
        ]
        
        # RAG 路由的关键词  
        rag_keywords = [
            "查找", "搜索", "找", "检索", "资料", "文档", "记录", "历史",
            "数据库", "知识库", "文件", "档案"
        ]
        
        # 统计匹配数量
        enhanced_matches = sum(1 for keyword in enhanced_keywords if keyword in text_lower)
        agent_matches = sum(1 for keyword in agent_keywords if keyword in text_lower)  
        rag_matches = sum(1 for keyword in rag_keywords if keyword in text_lower)
        
        # 文本长度和复杂度分析
        text_length = len(text)
        sentence_count = len([s for s in text.split('。') if s.strip()])
        
        # 决策逻辑
        if agent_matches >= 2 or any(word in text_lower for word in ["api", "工具", "执行", "计算"]):
            return {"route": "agent", "confidence": 0.85, "method": "rule_agent"}
            
        elif rag_matches >= 2 or any(word in text_lower for word in ["查找", "搜索", "资料"]):
            return {"route": "rag", "confidence": 0.8, "method": "rule_rag"}
            
        elif (enhanced_matches >= 2 or 
              text_length > 50 or 
              sentence_count > 1 or
              any(word in text_lower for word in ["写", "创作", "分析", "详细", "专业", "sonnet", "诗"])):
            return {"route": "enhanced", "confidence": 0.8, "method": "rule_enhanced"}
        
        else:
            return {"route": "basic", "confidence": 0.6, "method": "rule_basic"}

    def llm_enhanced_routing_analysis(self, routing_data: Dict[str, Any]) -> Dict[str, Any]:
        """LLM增强的路由分析，包含记忆上下文"""
        text = routing_data["text"]
        conversation_history = routing_data.get("conversation_history", "")
        pre_analysis = routing_data.get("pre_analysis", {})
        pre_hint = routing_data.get("routing_hint")
        
        if not text:
            return self._create_fallback_result("basic", 0.5, "empty_input")
        
        # 如果没有LLM，使用增强规则分析
        if not hasattr(self, 'llm') or not self.llm:
            rule_result = self.enhanced_rule_analysis(text, conversation_history)
            return rule_result
        
        try:
            # 包含记忆的LLM分析提示词
            if conversation_history:
                analysis_prompt = f"""请基于对话历史分析用户当前消息的路由需求。

对话历史:
{conversation_history}

当前用户消息: "{text}"

路由选项详细说明:
- basic: 简单问答、日常对话、基础信息查询
  示例: "你好"、"谢谢"、"今天天气怎么样"
  
- enhanced: 需要深度思考、创作、专业分析的复杂任务  
  示例: "写一首十四行诗"、"分析市场趋势"、"解释量子力学"、"设计方案"
  
- rag: 需要查找具体资料、文档、历史记录的任务
  示例: "查找相关资料"、"搜索文档"、"找到历史记录"
  
- agent: 需要调用工具、执行计算、API调用的任务  
  示例: "计算数据"、"执行代码"、"调用API"、"处理文件"

分析要点:
1. 考虑对话历史的上下文连续性
2. 判断当前消息是否是对之前对话的延续
3. 评估所需的处理复杂度和专业程度
4. 特别注意创作、分析类任务的延续性

请严格按照以下格式回答，只返回路由名称和置信度:
route:路由名称,confidence:0.XX"""
            else:
                analysis_prompt = f"""请仔细分析以下用户消息，确定最适合的处理路由。

用户消息: "{text}"

路由选项详细说明:
- basic: 简单问答、日常对话、基础信息查询
  示例: "你好"、"谢谢"、"今天天气怎么样"
  
- enhanced: 需要深度思考、创作、专业分析的复杂任务  
  示例: "写一首十四行诗"、"分析市场趋势"、"解释量子力学"、"设计方案"
  
- rag: 需要查找具体资料、文档、历史记录的任务
  示例: "查找相关资料"、"搜索文档"、"找到历史记录"
  
- agent: 需要调用工具、执行计算、API调用的任务  
  示例: "计算数据"、"执行代码"、"调用API"、"处理文件"

分析要点:
1. 任务的复杂程度和深度要求
2. 是否需要创造性思维  
3. 是否需要外部资源或工具
4. 预期回答的详细程度

请严格按照以下格式回答，只返回路由名称和置信度:
route:路由名称,confidence:0.XX"""
            
            # 调用LLM
            response = self.llm.invoke(analysis_prompt)
            llm_result = self._parse_llm_response(response.content)
            
            # 结合预分析和LLM分析结果
            final_result = self._combine_analysis_results(pre_analysis, llm_result, routing_data)
            return final_result
                
        except Exception as e:
            self.status = f"⚠️ LLM analysis failed: {str(e)[:30]}..."
            # LLM失败时使用增强规则分析
            rule_result = self.enhanced_rule_analysis(text, conversation_history)
            return rule_result

    def _parse_llm_response(self, response: str) -> Dict[str, Any]:
        """解析LLM响应"""
        try:
            route = "basic"
            confidence = 0.7
            
            response_lower = response.lower().strip()
            
            # 提取路由
            if "route:" in response_lower:
                try:
                    route_part = response_lower.split("route:")[1].split(",")[0].strip()
                    if route_part in ["basic", "enhanced", "rag", "agent"]:
                        route = route_part
                except:
                    pass
            else:
                # 直接匹配路由名称（enhanced优先）
                for r in ["enhanced", "agent", "rag", "basic"]:
                    if r in response_lower:
                        route = r
                        break
            
            # 提取置信度
            if "confidence:" in response_lower:
                try:
                    conf_part = response_lower.split("confidence:")[1].split(",")[0].strip()
                    confidence = float(conf_part)
                    confidence = max(0.0, min(1.0, confidence))
                except:
                    confidence = 0.7
            
            return {
                "route": route,
                "confidence": confidence,
                "method": "llm_analysis"
            }
            
        except Exception:
            return {"route": "basic", "confidence": 0.5, "method": "llm_parse_error"}

    def _combine_analysis_results(self, pre_analysis: Dict, llm_result: Dict, routing_data: Dict) -> Dict[str, Any]:
        """结合预分析和LLM分析结果"""
        
        pre_route = routing_data.get("routing_hint", "basic")
        pre_confidence = routing_data.get("confidence", 0.5)
        
        llm_route = llm_result["route"]
        llm_confidence = llm_result["confidence"]
        
        # 智能结合策略
        if self.analysis_mode == "llm_enhanced":
            # 以LLM为主
            final_route = llm_route
            final_confidence = llm_confidence
            
            if pre_route == llm_route and self.enable_confidence_boost:
                final_confidence = min(1.0, final_confidence + 0.1)
                
        elif self.analysis_mode == "hybrid":
            # 平衡策略 - 优先考虑非basic路由
            if llm_route != "basic" and llm_confidence >= 0.6:
                final_route = llm_route  
                final_confidence = llm_confidence
            elif pre_route != "basic" and pre_confidence >= 0.6:
                final_route = pre_route
                final_confidence = pre_confidence
            elif llm_confidence > pre_confidence:
                final_route = llm_route
                final_confidence = llm_confidence
            else:
                final_route = pre_route
                final_confidence = pre_confidence
                
        else:  # fast_rule
            rule_result = self.enhanced_rule_analysis(routing_data["text"], routing_data.get("conversation_history", ""))
            final_route = rule_result["route"]
            final_confidence = rule_result["confidence"]
        
        return {
            "route": final_route,
            "confidence": final_confidence,
            "method": f"{self.analysis_mode}_combined",
            "pre_analysis": pre_analysis,
            "llm_analysis": llm_result,
            "original_text": routing_data["text"],
            "conversation_history": routing_data.get("conversation_history", ""),
            "analysis_timestamp": time.time()
        }

    def _create_fallback_result(self, route: str, confidence: float, method: str) -> Dict[str, Any]:
        """创建后备结果"""
        return {
            "route": route,
            "confidence": confidence,
            "method": method,
            "fallback": True,
            "timestamp": time.time()
        }

    def get_lcel_routing_output(self) -> Message:
        """返回LCEL兼容的路由输出，包含记忆信息"""
        
        # 提取路由数据（包括记忆）
        routing_data = self.safe_extract_routing_data(self.input_message)
        original_text = routing_data.get("text", "")
        conversation_history = routing_data.get("conversation_history", "")
        
        # 执行智能路由分析
        analysis_result = self.llm_enhanced_routing_analysis(routing_data)
        
        # 创建LCEL兼容的输出Message
        route = analysis_result["route"]
        confidence = analysis_result["confidence"]
        
        # 根据开关决定消息内容
        if self.pass_route_as_text:
            message_text = route
        elif self.include_route_in_text and original_text:
            message_text = f"[{route.upper()}] {original_text}"
        else:
            message_text = original_text
        
        # 构建完整的metadata，包含记忆信息
        lcel_metadata = {
            # 核心路由信息
            "route": route,
            "routing_decision": route,
            "routing_hint": route,
            "confidence": confidence,
            
            # 原始输入保存
            "original_user_input": original_text,
            "original_text": original_text,
            
            # 记忆信息
            "conversation_history": conversation_history,
            "has_memory": bool(conversation_history),
            "memory_length": len(conversation_history) if conversation_history else 0,
            
            # 分析详情
            "analysis_result": analysis_result,
            "analysis_method": analysis_result.get("method", "unknown"),
            "analysis_mode": self.analysis_mode,
            
            # 文本传递方式
            "pass_route_as_text": self.pass_route_as_text,
            "include_route_in_text": self.include_route_in_text,
            
            # LCEL兼容性标记
            "lcel_compatible": True,
            "openai_format": True,
            "component_source": "OptimizedSmartRoutingFunction",
            
            # 时间戳和追踪
            "timestamp": time.time(),
            "routing_id": str(uuid.uuid4()),
            
            # 条件数据
            "conditions": {
                "is_basic": route == "basic",
                "is_enhanced": route == "enhanced",
                "is_rag": route == "rag",
                "is_agent": route == "agent",
                "confidence_sufficient": confidence >= 0.6,
                "requires_fallback": confidence < 0.5
            },
            
            # 技术细节
            "technical_info": {
                "llm_available": hasattr(self, 'llm') and self.llm is not None,
                "enable_confidence_boost": self.enable_confidence_boost,
                "default_route": self.default_route,
                "original_text_length": len(original_text),
                "has_pre_analysis": bool(routing_data.get("pre_analysis")),
                "has_conversation_history": bool(conversation_history),
                "message_construction": {
                    "pass_route_as_text": self.pass_route_as_text,
                    "include_route_in_text": self.include_route_in_text,
                    "final_text_type": "route" if self.pass_route_as_text else ("prefixed" if self.include_route_in_text else "original")
                }
            }
        }
        
        # 更新状态显示
        method_short = analysis_result.get("method", "unknown")[:15]
        memory_indicator = "📝" if conversation_history else "🆕"
        self.status = f"✅ Route: {route.upper()} ({confidence:.2f}) | {method_short} {memory_indicator}"
        
        return Message(
            text=message_text,
            metadata=lcel_metadata
        )

```

