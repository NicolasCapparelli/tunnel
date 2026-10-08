"""Small accessibility-driven driver for the development emulator smoke test."""
import json,os,re,subprocess,sys,time,xml.etree.ElementTree as ET
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
adb=Path(os.environ.get('ANDROID_HOME',str(Path.home()/'AppData/Local/Android/Sdk')))/'platform-tools/adb.exe'
root=Path(__file__).resolve().parents[1]
def run(*args):
    return subprocess.run([str(adb),'-s','emulator-5554',*args],check=True,capture_output=True,text=True,encoding='utf-8').stdout
def dump():
    run('shell','uiautomator','dump','/sdcard/tunnel-ui.xml')
    return ET.fromstring(run('shell','cat','/sdcard/tunnel-ui.xml'))
action=sys.argv[1]
if action=='inspect':
    for n in dump().iter('node'):
        if n.get('text') or n.get('content-desc'):
            info={k:n.get(k) for k in ('text','content-desc','bounds','clickable')}
            if n.get('content-desc')=='Pairing code' or '"key"' in n.get('text',''):info['text']='[pairing secret redacted]'
            print(info)
elif action=='jsoncheck':
    node=next(n for n in dump().iter('node') if n.get('content-desc')=='Pairing code')
    raw=node.get('text','')
    try:
        p=json.loads(raw);print({'length':len(raw),'version':p.get('v'),'endpoint':p.get('endpoint'),'keyLength':len(p.get('key',''))})
    except ValueError as e:print({'length':len(raw),'validJSON':False,'quoteCount':raw.count('"'),'errorPosition':e.pos,'braces':raw.count('{')+raw.count('}'),'redactedStructure':re.sub(r'[A-Za-z0-9]','x',raw)})
elif action=='has':
    label=sys.argv[2]
    print('yes' if any(label in (n.get('text','')+' '+n.get('content-desc','')) for n in dump().iter('node')) else 'no')
elif action in ('tap','bounds'):
    label=sys.argv[2]
    nodes=[n for n in dump().iter('node') if label in (n.get('text'),n.get('content-desc'))]
    if not nodes: raise RuntimeError(f'No Android accessibility node: {label}')
    x1,y1,x2,y2=map(int,re.findall(r'\d+',nodes[0].get('bounds')))
    if action=='bounds': print(f'{x1},{y1},{x2},{y2}')
    else: run('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
elif action=='text':
    value=sys.argv[2]
    for start in range(0,len(value),20):
        part=value[start:start+20].replace(' ','%s')
        quoted="'"+part.replace("'","'\\''")+"'"
        run('shell','input','text',quoted)
        time.sleep(.08)
elif action=='clear':
    run('shell','input','keycombination','113','29')
    run('shell','input','keyevent','67')
elif action=='swipe':run('shell','input','swipe',*sys.argv[2:])
elif action=='back':run('shell','input','keyevent','4')
elif action=='screenshot':
    run('shell','screencap','-p','/sdcard/tunnel-preview.png');run('pull','/sdcard/tunnel-preview.png',str(root/sys.argv[2]))
