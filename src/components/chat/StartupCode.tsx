// Function to generate the setup code with the correct outputId
const getSetupCode = (outputId: string) => `
import sys
import json
from IPython.display import display, HTML, Javascript

# Set up the display hook to target our specific output element
display(HTML(f"""
<div id="{outputId}-target"></div>
<script>
// Function to handle Jupyter display_data messages
window.jupyterDisplayData = window.jupyterDisplayData || {{}};
window.jupyterDisplayData["{outputId}"] = function(data) {{
  const targetElement = document.getElementById("{outputId}-target");
  if (!targetElement) return;
  
  if (data["text/html"]) {{
    targetElement.innerHTML = data["text/html"];
    
    // For self-contained Plotly HTML, we need to execute any scripts
    const scripts = targetElement.querySelectorAll('script');
    scripts.forEach(oldScript => {{
      if (!oldScript.parentNode) return;
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => 
        newScript.setAttribute(attr.name, attr.value)
      );
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    }});
  }} else if (data["image/png"]) {{
    const img = document.createElement("img");
    img.src = "data:image/png;base64," + data["image/png"];
    targetElement.appendChild(img);
  }} else if (data["application/vnd.plotly.v1+json"]) {{
    const plotlyDiv = document.createElement("div");
    plotlyDiv.className = "plotly-output";
    plotlyDiv.setAttribute("data-plotly", "true");
    plotlyDiv.style.width = "100%";
    plotlyDiv.style.minHeight = "400px";
    targetElement.appendChild(plotlyDiv);
    
    const plotlyData = data["application/vnd.plotly.v1+json"];
    
    const renderPlotly = () => {{
      if (typeof window.Plotly !== 'undefined') {{
        window.Plotly.newPlot(
          plotlyDiv, 
          plotlyData.data, 
          plotlyData.layout || {{responsive: true}},
          plotlyData.config || {{responsive: true}}
        ).catch(err => {{
          console.error('Error rendering Plotly:', err);
          plotlyDiv.innerHTML = '<div class="error-output">Error rendering Plotly: ' + err.message + '</div>';
        }});
      }}
    }};
    
    // Ensure Plotly is loaded before rendering
    if (!window.Plotly) {{
      const script = document.createElement("script");
      script.src = "https://cdn.plot.ly/plotly-2.24.1.min.js";
      script.onload = renderPlotly;
      document.head.appendChild(script);
    }} else {{
      renderPlotly();
    }}
  }} else if (data["text/plain"]) {{
    const pre = document.createElement("pre");
    pre.textContent = data["text/plain"];
    targetElement.appendChild(pre);
  }}
}};
</script>
"""))

# Create a custom display function that will send data to our output element
def custom_display_hook(*objs, **kwargs):
    for obj in objs:
        display(obj)
        # Also send to our custom output element
        display(Javascript(f"""
        if (window.jupyterDisplayData && window.jupyterDisplayData["{outputId}"]) {{
            window.jupyterDisplayData["{outputId}"](
                {json.dumps(obj._repr_mimebundle_()[0] if hasattr(obj, '_repr_mimebundle_') else {{'text/plain': str(obj)}})}
            );
        }}
        """))

# For matplotlib, we need to set up the backend
try:
    import matplotlib
    matplotlib.use('module://matplotlib_inline.backend_inline')
    import matplotlib.pyplot as plt
    plt.ion()  # Enable interactive mode
except ImportError:
    pass

# For plotly, ensure it uses the right renderer
try:
    import plotly.io as pio
    pio.renderers.default = 'jupyterlab'
    
    # Configure plotly express for proper display
    try:
        import plotly.express as px
        import plotly.graph_objects as go
        from IPython.display import display, HTML
        
        def display_plotly_figure(fig):
            """Helper function to display plotly figures"""
            display(HTML(fig.to_html(include_plotlyjs='cdn', full_html=False)))
        
        # Patch both px.Figure and go.Figure to use our display function
        px.Figure.show = display_plotly_figure
        go.Figure.show = display_plotly_figure
        
        print("Plotly configured for interactive output")
    except ImportError:
        pass
except ImportError:
    pass
`;

export default getSetupCode;