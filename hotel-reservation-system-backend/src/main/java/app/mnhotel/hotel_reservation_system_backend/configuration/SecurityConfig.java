package app.mnhotel.hotel_reservation_system_backend.configuration;
import java.util.Map;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.http.HttpMethod;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import app.mnhotel.hotel_reservation_system_backend.repository.UserRepository;
@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder(){return new BCryptPasswordEncoder();}
    @Bean UserDetailsService userDetailsService(UserRepository users){return name->users.findByUsernameIgnoreCase(name)
        .map(u->org.springframework.security.core.userdetails.User.withUsername(u.getUsername()).password(u.getPassword()==null?"":u.getPassword()).roles(u.getRole()).build())
        .orElseThrow(()->new UsernameNotFoundException("Credenciales incorrectas"));}
    @Bean AuthenticationManager authenticationManager(AuthenticationConfiguration c) throws Exception{return c.getAuthenticationManager();}
    @Bean HttpSessionSecurityContextRepository contextRepository(){return new HttpSessionSecurityContextRepository();}
    @Bean HttpSessionCsrfTokenRepository csrfRepository(){return new HttpSessionCsrfTokenRepository();}
    @Bean SecurityFilterChain security(HttpSecurity http,ObjectMapper json,HttpSessionSecurityContextRepository context,HttpSessionCsrfTokenRepository csrf) throws Exception {
        http.csrf(c->c.csrfTokenRepository(csrf).ignoringRequestMatchers(new AntPathRequestMatcher("/api/checkouts/stripe-webhook","POST")))
          .securityContext(c->c.securityContextRepository(context))
          .authorizeHttpRequests(a->a
            .requestMatchers("/api/auth/csrf","/api/auth/register","/api/auth/login","/api/health","/error").permitAll()
            .requestMatchers(HttpMethod.POST,"/api/checkouts/stripe-webhook").permitAll()
            .requestMatchers(HttpMethod.GET,"/api/hotels/**","/api/rooms/availability","/api/rooms/allocation","/api/rooms/*/occupancy").permitAll()

            .requestMatchers("/api/admin/**").hasRole("ADMIN")
            .requestMatchers("/api/**").authenticated().anyRequest().denyAll())
          .exceptionHandling(e->e.authenticationEntryPoint((req,res,ex)->{res.setStatus(401);res.setContentType("application/json");json.writeValue(res.getWriter(),Map.of("message","Inicia sesión para continuar"));})
            .accessDeniedHandler((req,res,ex)->{res.setStatus(403);res.setContentType("application/json");json.writeValue(res.getWriter(),Map.of("message","Acceso denegado o token CSRF inválido"));}))
          .logout(l->l.logoutUrl("/api/auth/logout").invalidateHttpSession(true).clearAuthentication(true).deleteCookies("JSESSIONID")
            .logoutSuccessHandler((req,res,a)->res.setStatus(204)));
        return http.build();
    }
}
