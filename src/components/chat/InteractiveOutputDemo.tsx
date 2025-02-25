import React from 'react';
import { InteractiveCodeBlock } from './InteractiveCodeBlock';

export const InteractiveOutputDemo: React.FC = () => {
  const matplotlibExample = `
# Matplotlib example
import matplotlib.pyplot as plt
import numpy as np

# Generate data
x = np.linspace(0, 10, 100)
y = np.sin(x)

# Create figure
plt.figure(figsize=(8, 4))
plt.plot(x, y, 'b-', linewidth=2)
plt.title('Interactive Matplotlib Plot')
plt.xlabel('X axis')
plt.ylabel('Y axis')
plt.grid(True)
plt.show()
`;

  const plotlyExample = `
# Plotly example with multiple visualization types
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np
from IPython.display import display

# Generate sample data
np.random.seed(42)
df = pd.DataFrame({
    'x': np.random.normal(0, 1, 100),
    'y': np.random.normal(0, 1, 100),
    'size': np.random.uniform(5, 15, 100),
    'category': np.random.choice(['A', 'B', 'C'], 100)
})

# Create a figure with subplots
fig = make_subplots(
    rows=2, cols=2,
    subplot_titles=('Scatter Plot', 'Box Plot', 'Histogram', 'Bar Chart'),
    specs=[[{'type': 'xy'}, {'type': 'xy'}],
           [{'type': 'xy'}, {'type': 'xy'}]]
)

# Add scatter plot
scatter = go.Scatter(
    x=df['x'], 
    y=df['y'],
    mode='markers',
    marker=dict(
        size=df['size'],
        color=df['x'],
        colorscale='Viridis',
        showscale=True
    ),
    name='Scatter'
)
fig.add_trace(scatter, row=1, col=1)

# Add box plot
box = go.Box(
    y=df['y'],
    x=df['category'],
    name='Box Plot'
)
fig.add_trace(box, row=1, col=2)

# Add histogram
hist = go.Histogram(
    x=df['x'],
    nbinsx=20,
    marker_color='rgba(0, 128, 128, 0.7)',
    name='Histogram'
)
fig.add_trace(hist, row=2, col=1)

# Add bar chart
bar_data = df.groupby('category').size().reset_index(name='count')
bar = go.Bar(
    x=bar_data['category'],
    y=bar_data['count'],
    marker_color='rgba(128, 0, 128, 0.7)',
    name='Bar Chart'
)
fig.add_trace(bar, row=2, col=2)

# Update layout
fig.update_layout(
    title='Interactive Plotly Dashboard',
    height=700,
    width=900,
    showlegend=False,
    template='plotly_white'
)

# Make it responsive
fig.update_layout(
    autosize=True,
    margin=dict(l=20, r=20, t=60, b=20),
)

# Display the figure
display(fig)
`;

  const pandasExample = `
# Pandas DataFrame example
import pandas as pd
import numpy as np

# Create sample data
np.random.seed(42)
data = {
    'Name': ['Alice', 'Bob', 'Charlie', 'David', 'Eva'],
    'Age': np.random.randint(20, 40, 5),
    'Salary': np.random.randint(50000, 100000, 5),
    'Department': np.random.choice(['HR', 'IT', 'Finance', 'Marketing'], 5)
}

# Create DataFrame
df = pd.DataFrame(data)

# Display the DataFrame
df
`;

  const plotlyDirectExample = `
# Plotly Express Direct HTML Example
import plotly.express as px
import numpy as np
import pandas as pd
from IPython.display import HTML

# Generate sample data
np.random.seed(42)
df = pd.DataFrame({
    'x': np.random.normal(0, 1, 100),
    'y': np.random.normal(0, 1, 100),
    'size': np.random.uniform(5, 15, 100),
    'category': np.random.choice(['A', 'B', 'C'], 100)
})

# Create a scatter plot with Plotly Express
fig = px.scatter(
    df, 
    x='x', 
    y='y', 
    color='category',
    size='size',
    hover_data=['category'],
    title='Interactive Plotly Scatter Plot',
    labels={'x': 'X Axis', 'y': 'Y Axis'},
    width=800,
    height=500
)

# Convert to HTML directly
html_str = fig.to_html(include_plotlyjs='cdn', full_html=False)

# Display directly as HTML
HTML(html_str)
`;

  return (
    <div className="space-y-8 p-4">
      <h1 className="text-2xl font-bold mb-4">Interactive Output Demo</h1>
      
      <div>
        <h2 className="text-xl font-semibold mb-2">Matplotlib Example</h2>
        <p className="text-gray-600 mb-4">
          This example demonstrates interactive Matplotlib visualization.
          The first time you run it, you might see "Matplotlib is building the font cache; this may take a moment."
          but subsequent runs will be faster.
        </p>
        <InteractiveCodeBlock code={matplotlibExample} defaultCollapsed={false} />
      </div>
      
      <div>
        <h2 className="text-xl font-semibold mb-2">Plotly Express Direct HTML</h2>
        <p className="text-gray-600 mb-4">
          This example demonstrates Plotly visualization using direct HTML output.
          It uses the <code>fig.to_html()</code> method to generate self-contained HTML.
        </p>
        <InteractiveCodeBlock code={plotlyDirectExample} defaultCollapsed={false} />
      </div>
      
      <div>
        <h2 className="text-xl font-semibold mb-2">Plotly Advanced Dashboard</h2>
        <p className="text-gray-600 mb-4">
          This example demonstrates interactive Plotly visualization with multiple plot types in a dashboard layout.
        </p>
        <InteractiveCodeBlock code={plotlyExample} defaultCollapsed={false} />
      </div>
      
      <div>
        <h2 className="text-xl font-semibold mb-2">Pandas DataFrame Example</h2>
        <p className="text-gray-600 mb-4">
          This example demonstrates interactive Pandas DataFrame display.
        </p>
        <InteractiveCodeBlock code={pandasExample} defaultCollapsed={false} />
      </div>
    </div>
  );
};