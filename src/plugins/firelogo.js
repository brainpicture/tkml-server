/**
 * FireLogo Plugin for TKML
 * Adds custom styling with elegant WebGL background
 */

(function () {
    // Create a style element
    const style = document.createElement('style');

    // Add CSS rules
    style.textContent = `
.header {
    opacity: 0.8;
    font-size: 90px;
    padding: 40px 0px 20px;
    position: relative;
    z-index: 1;
}

.webgl-background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: -1;
}

.tkml-header {
    position: relative;
}
    `;

    // Add the style element to the document head
    document.head.appendChild(style);

    // Create WebGL background only once for the entire page
    function createWebGLBackground() {
        // Create canvas for WebGL
        const canvas = document.createElement('canvas');
        canvas.className = 'webgl-background';

        // Add canvas to the body as the first element
        document.body.insertBefore(canvas, document.body.firstChild);

        // Initialize WebGL
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
            console.warn('WebGL not supported');
            return;
        }

        // Set canvas size to full viewport
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            gl.viewport(0, 0, canvas.width, canvas.height);
        }

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Simple vertex shader
        const vsSource = `
            attribute vec2 position;
            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;

        // Fragment shader with elegant flowing patterns based on #10161f
        const fsSource = `
            precision highp float;
            uniform float time;
            uniform vec2 resolution;
            
            // Base color: #10161f (RGB: 16, 22, 31)
            vec3 baseColor = vec3(0.063, 0.086, 0.122);
            
            // Simple hash function
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }
            
            // Smooth noise for better gradients
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f); // Smoothstep
                
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                
                return mix(
                    mix(a, b, f.x),
                    mix(c, d, f.x),
                    f.y
                );
            }
            
            // Fractal Brownian Motion for layered noise
            float fbm(vec2 p) {
                float value = 0.0;
                float amplitude = 0.5;
                float frequency = 1.0;
                
                // Add several octaves of noise
                for (int i = 0; i < 5; i++) {
                    value += amplitude * noise(p * frequency);
                    amplitude *= 0.5;
                    frequency *= 2.0;
                }
                
                return value;
            }
            
            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                float t = time * 0.2; // Moderate speed movement
                
                // Create flowing effect with multiple layers
                vec2 p = uv * 2.0 - 1.0;
                p.x *= resolution.x / resolution.y;
                
                // Create elegant flowing patterns
                float flow1 = fbm(p * 2.5 + vec2(t * 0.3, t * 0.2));
                float flow2 = fbm(p * 1.2 + vec2(-t * 0.2, t * 0.1) + flow1 * 0.4);
                float flow3 = fbm(p * 0.6 + vec2(t * 0.1, -t * 0.15) + flow2 * 0.3);
                
                // Combine flows with varying weights
                float flowValue = flow1 * 0.5 + flow2 * 0.3 + flow3 * 0.2;
                
                // Create wave patterns
                float wave1 = sin(p.x * 3.0 + t + flowValue * 4.0) * 0.5 + 0.5;
                float wave2 = sin(p.y * 2.0 - t * 0.5 + flow2 * 3.0) * 0.5 + 0.5;
                float waves = wave1 * wave2;
                
                // Create elegant color variations while keeping the base color theme
                vec3 color1 = baseColor; // Base color #10161f
                vec3 color2 = baseColor + vec3(0.07, 0.09, 0.14); // Lighter
                vec3 color3 = baseColor + vec3(0.03, 0.06, 0.1); // Slightly lighter
                vec3 color4 = baseColor - vec3(0.02, 0.02, 0.01); // Slightly darker
                
                // Add some accent colors
                vec3 accentBlue = vec3(0.1, 0.15, 0.3); // Subtle blue accent
                vec3 accentTeal = vec3(0.05, 0.12, 0.15); // Subtle teal accent
                vec3 accentPurple = vec3(0.1, 0.05, 0.15); // Subtle purple accent
                
                // Mix colors based on flow and wave patterns
                vec3 finalColor = mix(color1, color2, flowValue * 0.7);
                finalColor = mix(finalColor, color3, waves * 0.6);
                finalColor = mix(finalColor, color4, flow3 * 0.4);
                
                // Add subtle accents based on different flow patterns
                float accentMask1 = smoothstep(0.4, 0.6, flow1 * flow2);
                float accentMask2 = smoothstep(0.3, 0.7, flow2 * flow3);
                float accentMask3 = smoothstep(0.2, 0.8, flow3 * waves);
                
                finalColor = mix(finalColor, accentBlue, accentMask1 * 0.15);
                finalColor = mix(finalColor, accentTeal, accentMask2 * 0.1);
                finalColor = mix(finalColor, accentPurple, accentMask3 * 0.12);
                
                // Add occasional "glints" of light
                float glint = pow(flow2 * flow3, 4.0) * 1.5;
                finalColor += vec3(0.08, 0.1, 0.15) * glint;
                
                // Add a subtle pulsing effect
                float pulse = sin(t * 0.5) * 0.5 + 0.5;
                finalColor += vec3(0.01, 0.015, 0.025) * pulse * flowValue;
                
                // Add a subtle vignette
                float vignette = 1.0 - smoothstep(0.4, 1.5, length(p)) * 0.3;
                finalColor *= vignette;
                
                // Add subtle color shifting over time
                float colorShift = sin(t * 0.2) * 0.5 + 0.5;
                finalColor = mix(
                    finalColor,
                    finalColor * vec3(1.0, 1.03, 1.06), // Slightly shift toward blue
                    colorShift * 0.15
                );
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

        // Create shader program
        function createShaderProgram(gl, vsSource, fsSource) {
            const vertexShader = gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(vertexShader, vsSource);
            gl.compileShader(vertexShader);

            const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fragmentShader, fsSource);
            gl.compileShader(fragmentShader);

            const program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);

            return program;
        }

        // Create and use shader program
        const program = createShaderProgram(gl, vsSource, fsSource);
        gl.useProgram(program);

        // Create a simple full-screen quad
        const positions = new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1
        ]);

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        // Set up attributes and uniforms
        const positionLocation = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        const timeLocation = gl.getUniformLocation(program, 'time');
        const resolutionLocation = gl.getUniformLocation(program, 'resolution');

        // Animation loop
        let startTime = Date.now();
        let animationFrameId;

        function render() {
            const currentTime = (Date.now() - startTime) / 1000;

            // Update uniforms
            gl.uniform1f(timeLocation, currentTime);
            gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

            // Draw the quad
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            animationFrameId = requestAnimationFrame(render);
        }

        // Start animation
        render();

        // Clean up when page unloads
        window.addEventListener('unload', () => {
            cancelAnimationFrame(animationFrameId);
        });
    }

    // Run the effect when the DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createWebGLBackground);
    } else {
        // DOM is already loaded
        createWebGLBackground();
    }

    // Return the plugin API
    return {
        name: 'firelogo',
        version: '1.4.0'
    };
})();
