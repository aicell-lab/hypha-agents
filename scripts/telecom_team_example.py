"""Ericsson Emergency Response Team: Dynamic multi-agent collaboration for network outage resolution."""
import asyncio
import random
from schema_agents import Role, schema_tool
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from schema_agents.role import create_session_context
from schema_agents.utils.common import EventBus

class NetworkAlert(BaseModel):
    """Critical network alert structure"""
    alert_id: str = Field(description="Unique alert identifier")
    severity: int = Field(description="Severity level 1-5", ge=1, le=5)
    affected_areas: List[str] = Field(description="List of impacted network nodes")
    customer_impact: str = Field(description="Description of customer impact")

class RepairPlan(BaseModel):
    """Network repair action plan"""
    plan_id: str = Field(description="Unique plan identifier")
    required_skills: List[str] = Field(description="List of required technical skills")
    estimated_duration: int = Field(description="Estimated repair time in minutes")
    risk_assessment: str = Field(description="Potential risks during repair")

class FieldReport(BaseModel):
    """Field technician status report"""
    technician_id: str = Field(description="ID of the field technician")
    location: str = Field(description="Current GPS coordinates")
    equipment_status: str = Field(description="Status of repair equipment")
    findings: str = Field(description="Technical findings from site")

class PublicCommsStatus(BaseModel):
    """Parameters for public communications update"""
    status: str = Field(description="Current status message to communicate to customers")

class CustomerImpactMessage(BaseModel):
    """Parameters for customer impact message drafting"""
    impact: str = Field(description="Description of the service impact affecting customers")

async def main():
    event_bus = EventBus("telecom_emergency")
    # event_bus.register_default_events()

    async with create_session_context(event_bus=event_bus):
        print("\n🔧 INITIALIZING EMERGENCY RESPONSE TEAM")
        # Create team roles with specialized skills
        commander = Role(
            name="Network Commander",
            profile="Crisis Manager",
            goal="Orchestrate emergency response and minimize customer impact",
            constraints="Must maintain communication with all teams and prioritize critical systems",
            model="gpt-4o-mini",
            stream=True,
        )
        print(f"🚨 [Network Commander] ready - {commander.profile}")

        field_tech = Role(
            name="Field Technician",
            profile="Hardware Specialist",
            goal="Execute physical repairs and provide ground truth data",
            constraints="Must verify safety protocols before any physical intervention",
            model="gpt-4o-mini",
        )
        print(f"🔧 [Field Technician] ready - {field_tech.profile}")

        analyst = Role(
            name="System Analyst",
            profile="Data Scientist",
            goal="Analyze network patterns and predict failure cascades",
            constraints="Must validate predictions with real-time data",
            model="gpt-4o-mini",
        )
        print(f"📊 [System Analyst] ready - {analyst.profile}")

        support_agent = Role(
            name="Customer Support",
            profile="Client Relations",
            goal="Manage customer communications and outage updates",
            constraints="Must maintain truthful but calming communications",
            model="gpt-4o-mini",
        )
        print(f"📢 [Customer Support] ready - {support_agent.profile}")

        # Shared network state
        network_status = {
            "outage_resolved": False,
            "active_alerts": [],
            "repairs_in_progress": [],
            "customer_notifications": []
        }

        @schema_tool
        async def dispatch_field_team(alert: NetworkAlert) -> str:
            """Dispatch field team to handle network alert and coordinate repair attempts"""
            print(f"\n🔧 [Field Technician] DISPATCH ORDER: Alert {alert.alert_id}")
            print(f"   Affected Areas: {', '.join(alert.affected_areas)}")
            print(f"   Customer Impact: {alert.customer_impact}")
            
            attempts = 0
            while attempts < 3 and not network_status['outage_resolved']:
                print(f"\n🔧 [Field Technician] ATTEMPT {attempts+1}/3 - FIELD OPERATION")
                attempt_report = await field_tech.acall(
                    [f"Perform emergency repair for {alert.affected_areas} - Attempt {attempts+1}"],
                    [generate_repair_plan, update_equipment_status]
                )
                print(f"   Field Report: {attempt_report}")
                
                if "SUCCESS" in attempt_report:
                    print(f"✅ REPAIR SUCCESS! Removed {alert.alert_id} from active repairs")
                    network_status['repairs_in_progress'].remove(alert.alert_id)
                    return f"✅ Field repair completed: {attempt_report}"
                
                attempts += 1
                print(f"⚠️ RETRYING... (Attempt {attempts})")
            
            print("❌ MAX ATTEMPTS REACHED - ESCALATING TO SENIOR ENGINEERS")
            return "❌ Maximum repair attempts reached - Escalating to senior engineers"

        @schema_tool
        async def generate_repair_plan(alert: NetworkAlert) -> RepairPlan:
            """Generate detailed repair plan based on network analysis"""
            print(f"\n📊 [System Analyst] GENERATING REPAIR PLAN for {alert.alert_id}")
            analysis = await analyst.acall(
                [f"Analyze failure patterns for {alert.affected_areas}"],
                [predict_failure_cascade]
            )
            print(f"   Analyst Prediction: {analysis}")
            
            return RepairPlan(
                plan_id=f"PLAN-{random.randint(1000,9999)}",
                required_skills=["Fiber Optics", "Power Systems"],
                estimated_duration=45,
                risk_assessment=analysis
            ).model_dump(mode="json")

        @schema_tool
        async def update_public_comms(comms_status: PublicCommsStatus) -> str:
            """Update public communications channels with current outage status"""
            print(f"\n📢 [Customer Support] PUBLIC COMMS UPDATE: {comms_status.status}")
            response = await support_agent.acall(
                [f"Update customer messaging based on: {comms_status.status}"],
                [draft_customer_message]
            )
            print(f"   Drafted Message: {response}")
            network_status['customer_notifications'].append(response)
            return f"📢 Public update posted: {response}"

        @schema_tool
        def predict_failure_cascade(alert: NetworkAlert) -> str:
            """Predict potential cascade failures using current alert data"""
            return f"High risk ({random.randint(30,70)}%) of cascade failure in adjacent sectors"

        @schema_tool
        def update_equipment_status(report: FieldReport) -> str:
            """Log field equipment and safety status"""
            return f"Equipment {report.equipment_status} at {report.location}"

        @schema_tool
        def draft_customer_message(message_params: CustomerImpactMessage) -> str:
            """Create customer-friendly outage notification"""
            return f"Service Alert: {message_params.impact} - Crews working to restore service"

        async def emergency_response_loop():
            print("\n🚨 [Network Commander] EMERGENCY PROTOCOLS ACTIVATED")
            stages = [
                "Initial Outage Detection",
                "Root Cause Analysis",
                "Emergency Repair",
                "Service Verification"
            ]
            
            for stage in stages:
                print(f"\n🚨 [Network Commander] STAGE: {stage.upper()}")
                print("----------------------------")
                stage_result = await commander.acall(
                    [f"Execute stage: {stage}", f"Network Status: {network_status}"],
                    [dispatch_field_team, generate_repair_plan, update_public_comms]
                )
                
                print(f"\n🏁 STAGE RESULT: {stage_result}")
                print(f"   Active Alerts: {len(network_status['active_alerts'])}")
                print(f"   Ongoing Repairs: {len(network_status['repairs_in_progress'])}")
                print(f"   Customer Notifications: {len(network_status['customer_notifications'])}")
                
                if "CRITICAL_FAILURE" in stage_result:
                    print("\n🚨 CRITICAL FAILURE DETECTED! ACTIVATING CONTINGENCY PLANS")
                    await update_public_comms(PublicCommsStatus(status="Critical system failure - Emergency protocols activated"))
                    break
                
                if network_status['outage_resolved']:
                    print("\n🎉 SERVICE RESTORATION CONFIRMED!")
                    print("   Final Network Status:")
                    print(f"   - Resolved Alerts: {len(network_status['active_alerts'])}")
                    print(f"   - Successful Repairs: {len(network_status['repairs_in_progress'])}")
                    await update_public_comms(PublicCommsStatus(status="All services restored"))
                    return

            print("\n⚠️ EXTENDED OUTAGE PROTOCOLS ENGAGED")
            print(f"📢 [Customer Support] Final notification: {network_status['customer_notifications'][-1]}")

        # Simulate network emergency
        network_status.update({
            "active_alerts": [NetworkAlert(
                alert_id="NET-ALERT-2024",
                severity=1,
                affected_areas=["Node-5", "Hub-12"],
                customer_impact="Mobile data outage"
            )]
        })
        
        print("🚀 INITIATING EMERGENCY RESPONSE PROTOCOLS")
        await emergency_response_loop()
        print("📊 FINAL NETWORK STATUS:", network_status)

if __name__ == "__main__":
    asyncio.run(main()) 