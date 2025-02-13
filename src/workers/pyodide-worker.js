/* eslint-env worker */
/* global loadPyodide, globalThis, self */
/* eslint-disable no-restricted-globals */

// Explicitly declare self for web worker context
const _self = self;

const indexURL = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/';

// Import Pyodide dynamically
let pyodidePromise = import("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.mjs");

// Initialize outputs array and helper functions
let outputs = [];

// Expose write function to self
self.write = function(type, content) {
    self.postMessage({ type, content });
    outputs.push({ type, content });
    return content.length;
};

// Expose other helper functions
self.logService = function(type, url, attrs) {
    outputs.push({type, content: url, attrs: attrs?.toJs({dict_converter : Object.fromEntries})});
    self.postMessage({ type, content: url, attrs: attrs?.toJs({dict_converter : Object.fromEntries}) });
};

self.show = function(type, url, attrs) {
    // const turl = url.length > 32 ? url.slice(0, 32) + "..." : url;
    outputs.push({type, content: url, attrs: attrs?.toJs({dict_converter : Object.fromEntries})});
    self.postMessage({ type, content: url, attrs: attrs?.toJs({dict_converter : Object.fromEntries}) });
};

// Stand-in for `time.sleep`, which does not actually sleep.
// To avoid a busy loop, instead import asyncio and await asyncio.sleep().
function spin(seconds) {
    const time = performance.now() + seconds * 1000;
    while (performance.now() < time);
}

// Start loading Pyodide
(async () => {
    // Get the loadPyodide function from the imported module
    const { loadPyodide } = await pyodidePromise;
    self.pyodide = await loadPyodide({ indexURL });
    await self.pyodide.loadPackage("micropip");
    const micropip = self.pyodide.pyimport("micropip");
    await micropip.install(['numpy', 'hypha-rpc', 'pyodide-http', 'plotly', 'pandas', 'kaleido']);
    // NOTE: We intentionally avoid runPythonAsync here because we don't want this to pre-load extra modules like matplotlib.
    self.pyodide.runPython(setupCode);
    self.postMessage({loading: true});  // Inform the main thread that we finished loading.
})();

// NOTE: eval(compile(source, "<string>", "exec", ast.PyCF_ALLOW_TOP_LEVEL_AWAIT))
// returns a coroutine if `source` contains a top-level await, and None otherwise.

const setupCode = `
import array
import ast
import base64
import contextlib
import io
import js
import pyodide
import sys
import time
import traceback
import wave
import pyodide_http

python_version = f"{sys.version_info.major}.{sys.version_info.minor}"; print(python_version)

pyodide_http.patch_all()  # Patch all libraries
help_string = f"""
Welcome to BioImage.IO Chatbot Debug console!
Python {python_version} on Pyodide {pyodide.__version__}

In this console, you can run Python code and interact with the code interpreter used by the chatbot.
You can inspect variables, run functions, and more.

If this is your first time using Python, you should definitely check out
the tutorial on the internet at https://docs.python.org/{python_version}/tutorial/.
Enter the name of any module, keyword, or topic to get help on writing
Python programs and using Python modules.  To quit this help utility and
return to the interpreter, just type "quit".
To get a list of available modules, keywords, symbols, or topics, type
"modules", "keywords", "symbols", or "topics".  Each module also comes
with a one-line summary of what it does; to list the modules whose name
or summary contain a given string such as "spam", type "modules spam".
"""

__builtins__.help = lambda *args, **kwargs: print(help_string)

# patch hypha services
import hypha_rpc
_connect_to_server = hypha_rpc.connect_to_server

async def patched_connect_to_server(*args, **kwargs):
    server = await _connect_to_server(*args, **kwargs)
    _register_service = server.register_service
    async def patched_register_service(*args, **kwargs):
        svc_info = await _register_service(*args, **kwargs)
        service_id = svc_info['id'].split(':')[1]
        service_url = f"{server.config['public_base_url']}/{server.config['workspace']}/services/{service_id}"
        js.logService("service", service_url, svc_info)
        return svc_info
    server.register_service = patched_register_service
    server.registerService = patched_register_service
    return server

hypha_rpc.connect_to_server = patched_connect_to_server

# For redirecting stdout and stderr later.
class JSOutWriter(io.TextIOBase):
    def write(self, s):
        return js.write("stdout", s)

class JSErrWriter(io.TextIOBase):
    def write(self, s):
        return js.write("stderr", s)

def setup_matplotlib():
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    def show():
        buf = io.BytesIO()
        plt.savefig(buf, format='png')
        img = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('utf-8')
        js.show("img", img)
        plt.clf()

    plt.show = show

def show_image(image, **attrs):
    from PIL import Image
    if not isinstance(image, Image.Image):
        image = Image.fromarray(image)
    buf = io.BytesIO()
    image.save(buf, format='png')
    data = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('utf-8')
    js.show("img", data, attrs)


def show_animation(frames, duration=100, format="apng", loop=0, **attrs):
    from PIL import Image
    buf = io.BytesIO()
    img, *imgs = [frame if isinstance(frame, Image.Image) else Image.fromarray(frame) for frame in frames]
    img.save(buf, format='png' if format == "apng" else format, save_all=True, append_images=imgs, duration=duration, loop=0)
    img = f'data:image/{format};base64,' + base64.b64encode(buf.getvalue()).decode('utf-8')
    js.show("img", img, attrs)

def convert_audio(data):
    try:
        import numpy as np
        is_numpy = isinstance(data, np.ndarray)
    except ImportError:
        is_numpy = False
    if is_numpy:
        if len(data.shape) == 1:
            channels = 1
        if len(data.shape) == 2:
            channels = data.shape[0]
            data = data.T.ravel()
        else:
            raise ValueError("Too many dimensions (expected 1 or 2).")
        return ((data * (2**15 - 1)).astype("<h").tobytes(), channels)
    else:
        data = array.array('h', (int(x * (2**15 - 1)) for x in data))
        if sys.byteorder == 'big':
            data.byteswap()
        return (data.tobytes(), 1)

def show_audio(samples, rate):
    bytes, channels = convert_audio(samples)
    buf = io.BytesIO()
    with wave.open(buf, mode='wb') as w:
        w.setnchannels(channels)
        w.setframerate(rate)
        w.setsampwidth(2)
        w.setcomptype('NONE', 'NONE')
        w.writeframes(bytes)
    audio = 'data:audio/wav;base64,' + base64.b64encode(buf.getvalue()).decode('utf-8')
    js.show("audio", audio)

# HACK: Prevent 'wave' import from failing because audioop is not included with pyodide.
import types
import ast
embed = types.ModuleType('embed')
sys.modules['embed'] = embed
embed.image = show_image
embed.animation = show_animation
embed.audio = show_audio

def preprocess_code(source):
    """Parse the source code and separate it into main code and last expression."""
    parsed_ast = ast.parse(source)
    
    last_node = parsed_ast.body[-1] if parsed_ast.body else None
    
    if isinstance(last_node, ast.Expr):
        # Separate the AST into main body and last expression
        main_body_ast = ast.Module(body=parsed_ast.body[:-1], type_ignores=parsed_ast.type_ignores)
        last_expr_ast = last_node
        
        # Convert main body AST back to source code for exec
        main_body_code = ast.unparse(main_body_ast)
        
        return main_body_code, last_expr_ast
    else:
        # If the last node is not an expression, treat the entire code as the main body
        return source, None
    

context = {}

# Add display system support
class DisplayHandle:
    def __init__(self):
        self._display_id = 0
        
    def _repr_mimebundle_(self, include=None, exclude=None):
        return {}, {}

class DisplayPublisher:
    def __init__(self):
        self.handles = {}
        
    def publish(self, data, metadata=None, source=None, *, transient=None, **kwargs):
        if metadata is None:
            metadata = {}
        if transient is None:
            transient = {}
        
        for mime, content in data.items():
            if mime == 'text/html':
                js.show("html", content, metadata)
            elif mime == 'image/png':
                js.show("img", f"data:image/png;base64,{content}", metadata)
            elif mime == 'image/svg+xml':
                js.show("svg", content, metadata)
            elif mime == 'text/plain':
                print(content)

    def display(self, obj, display_id=None, **kwargs):
        if hasattr(obj, '_repr_mimebundle_'):
            data, metadata = obj._repr_mimebundle_()
            self.publish(data, metadata, display_id=display_id, **kwargs)
            return

        # Try rich display methods in order of preference
        mimetypes = ['_repr_html_', '_repr_svg_', '_repr_png_', '_repr_jpeg_', 
                    '_repr_latex_', '_repr_json_', '_repr_javascript_']
        
        for mimetype in mimetypes:
            if hasattr(obj, mimetype):
                method = getattr(obj, mimetype)
                try:
                    data = method()
                    if data:
                        if mimetype == '_repr_html_':
                            js.show("html", data, {})
                            return
                        elif mimetype == '_repr_svg_':
                            js.show("svg", data, {})
                            return
                        elif mimetype == '_repr_png_':
                            js.show("img", f"data:image/png;base64,{data}", {})
                            return
                except Exception:
                    continue
        
        # If no rich representation is found, create a basic HTML representation
        try:
            html_str = f"<pre>{html.escape(str(obj))}</pre>"
            js.show("html", html_str, {})
        except:
            # Final fallback to plain text
            print(str(obj))

# Create global display publisher
display_publisher = DisplayPublisher()
__builtins__.display = display_publisher.display

# Support for pandas DataFrame display
try:
    import pandas as pd
    pd.set_option('display.notebook_repr_html', True)
except ImportError:
    pass

# Support for numpy array display
try:
    import numpy as np
    def numpy_display_formatter(arr):
        try:
            return f"<pre>{html.escape(np.array2string(arr))}</pre>"
        except:
            return str(arr)
            
    # Register custom display function for numpy arrays
    def display_array(arr):
        js.show("html", numpy_display_formatter(arr), {})
        
    # Patch the display function to handle numpy arrays
    _original_display = display_publisher.display
    def enhanced_display(obj, *args, **kwargs):
        if 'numpy' in sys.modules and isinstance(obj, np.ndarray):
            display_array(obj)
        else:
            _original_display(obj, *args, **kwargs)
    
    __builtins__.display = enhanced_display
except ImportError:
    pass

# Support for Plotly interactive display
try:
    import plotly.graph_objects as go
    from plotly.io import to_json
    
    def plotly_show(fig):
        fig_json = to_json(fig, validate=False)
        js.show("plotly", fig_json)
    
    go.Figure.show = plotly_show
except ImportError:
    pass

# Enhance the context evaluation to handle rich display
async def run(source, io_context):
    out = JSOutWriter()
    err = JSErrWriter()
    io_context = io_context or {}
    inputs = io_context.get("inputs") or []
    outputs = io_context.get("outputs") or []
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        try:
            imports = pyodide.code.find_imports(source)
            await js.pyodide.loadPackagesFromImports(source)
            if "matplotlib" in imports or "skimage" in imports:
                setup_matplotlib()
            if "embed" in imports:
                await js.pyodide.loadPackagesFromImports("import numpy, PIL")
            
            source, last_expression = preprocess_code(source)
            code = compile(source, "<string>", "exec", ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)

            result = eval(code, context)
            if result is not None:
                result = await result
                
            if last_expression:
                if isinstance(last_expression.value, ast.Await):
                    last_expr_code = compile(ast.Expression(last_expression.value), "<string>", "eval", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
                    result = await eval(last_expr_code, context)
                else:
                    last_expr_code = compile(ast.Expression(last_expression.value), "<string>", "eval")
                    result = eval(last_expr_code, context)
                if result is not None:
                    # Use display for the result instead of print
                    display_publisher.display(result)
        except:
            traceback.print_exc()
            raise
`
const mountedFs = {}

self.onmessage = async (event) => {
    if(event.data.source){
        try{
            const { source, io_context } = event.data
            self.pyodide.globals.set("source", source)
            self.pyodide.globals.set("io_context", io_context && self.pyodide.toPy(io_context))
            outputs = []
            // see https://github.com/pyodide/pyodide/blob/b177dba277350751f1890279f5d1a9096a87ed13/src/js/api.ts#L546
            // sync native ==> browser
            await new Promise((resolve, _) => self.pyodide.FS.syncfs(true, resolve));
            await self.pyodide.runPythonAsync("await run(source, io_context)")
            // sync browser ==> native
            await new Promise((resolve, _) => self.pyodide.FS.syncfs(false, resolve));
            console.log("Execution done", outputs)
            self.postMessage({ executionDone: true, outputs })
            outputs = []
        }
        catch(e){
            console.error("Execution Error", e)
            self.postMessage({ executionError: e.message })
        }
    }
    if(event.data.mount){
        try{
            const { mountPoint, dirHandle } = event.data.mount
            if(mountedFs[mountPoint]){
                console.log("Unmounting native FS:", mountPoint)
                await self.pyodide.FS.unmount(mountPoint)
                delete mountedFs[mountPoint]
            }
            const nativefs = await self.pyodide.mountNativeFS(mountPoint, dirHandle)
            mountedFs[mountPoint] = nativefs
            console.log("Native FS mounted:", mountPoint, nativefs)
            self.postMessage({ mounted: mountPoint })
        }
        catch(e){
            self.postMessage({ mountError: e.message })
        }
    }
};