# JavaScript Brainfuck interpreter #

As the title implies, this is a [Brainfuck](http://esolangs.org/wiki/Brainfuck) interpreter written in JavaScript. 

Currently it simply runs your code without further ado. There is basic support for input through an onkeydown event.

## Usage ##

Enter your Brainfuck code in the Brainfuck input field

If you want to do a plain execution, click 'Run'

If you want to debug and step through, click 'Step'

If you want to slowly automatically step through, click 'Step auto:' after entering how many miliseconds you want the debugger to wait between steps.

You can stop auto-stepping by clicking 'Stop'

Re-initialize the program by clicking 'Initialize'


## Latest upgrades ##

You can now run infinite loops with the run button. Automatic throttling has been added. This works by delaying execution for 5ms every 1000 instructions executed. You can change how frequently the delay occurs by changing THROTTLE_THRESHOLD to another value.

Memory size is now set to 512 Bytes.

Improved functionality of the Stop button, added Pause button.

Major rework of the workings of 'program'; now works with statuses which provide better control.

A bit of design work has been undertaken to make it look less 'lazy'.